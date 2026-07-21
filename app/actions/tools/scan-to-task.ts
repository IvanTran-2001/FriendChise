"use server";

import { PermissionAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTask } from "@/lib/services/tasks";
import {
  getScanSourceKind,
  inferScanTaskDraftFromStorage,
  type ScanTaskDraft,
} from "@/lib/ai/scan-to-task";
import { prisma } from "@/lib/platform/prisma";
import { requireOrgPermissionAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import {
  createSignedUploadUrl,
  deleteStorageFile,
} from "@/lib/platform/supabase-storage";

const MAX_FILES = 12;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const SCAN_UPLOAD_PREFIX = "scan-to-task";

const scanSourceSchema = z.object({
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

const confirmScanToTaskSchema = z.object({
  resultId: z.string().min(1),
  fileName: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  summary: z.string().max(500),
  durationMin: z.coerce.number().int().positive().max(24 * 60),
  peopleRequired: z.coerce.number().int().min(1).max(50),
  minWaitDays: z.coerce.number().int().min(0).max(3650),
  maxWaitDays: z.coerce.number().int().min(0).max(3650),
});

const getUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

const deleteUploadsSchema = z.object({
  storagePaths: z.array(z.string().min(1)).min(1),
});

export type ScanToTaskUploadUrlActionState =
  | { ok: true; signedUrl: string; path: string }
  | { ok: false; error: string };

export type ScanToTaskResultItem =
  | {
      ok: true;
      fileName: string;
      fileKind: string;
      draft: ScanTaskDraft;
    }
  | {
      ok: false;
      fileName: string;
      fileKind: string;
      error: string;
    };

export type ScanToTaskActionState =
  | { ok: true; results: ScanToTaskResultItem[] }
  | { ok: false; error: string };

export type ConfirmScanToTaskActionState =
  | {
      ok: true;
      resultId: string;
      taskId: string;
      taskHref: string;
    }
  | { ok: false; error: string };

function normalizeInstruction(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function colorFromSeed(seed: string) {
  const palette = [
    "#0EA5E9",
    "#14B8A6",
    "#22C55E",
    "#F59E0B",
    "#F97316",
    "#EC4899",
    "#8B5CF6",
    "#6366F1",
  ];
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

function buildTempUploadPath(orgId: string, fileName: string, mimeType: string) {
  const kind = getScanSourceKind(fileName, mimeType);
  const extByKind: Record<string, string> = {
    image: mimeType.split("/")[1] || "png",
    pdf: "pdf",
    docx: "docx",
    text: fileName.toLowerCase().endsWith(".md") ? "md" : fileName.toLowerCase().endsWith(".csv") ? "csv" : fileName.toLowerCase().endsWith(".json") ? "json" : fileName.toLowerCase().endsWith(".xml") ? "xml" : "txt",
    unknown: "bin",
  };
  const ext = extByKind[kind] ?? "bin";
  return `orgs/${orgId}/${SCAN_UPLOAD_PREFIX}/${crypto.randomUUID()}.${ext}`;
}

async function cleanupUploads(storagePaths: string[]) {
  await Promise.allSettled(storagePaths.map((storagePath) => deleteStorageFile(storagePath)));
}

export async function getScanToTaskUploadUrlAction(
  orgId: string,
  _prevState: ScanToTaskUploadUrlActionState | null,
  formData: FormData,
): Promise<ScanToTaskUploadUrlActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const parsed = getUploadUrlSchema.safeParse({
    fileName: formData.get("fileName"),
    mimeType: formData.get("mimeType"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Provide a valid file before uploading." };
  }

  const storagePath = buildTempUploadPath(orgId, parsed.data.fileName, parsed.data.mimeType);
  const signed = await createSignedUploadUrl(storagePath, MAX_FILE_BYTES);
  if (!signed.ok) return { ok: false, error: signed.error };

  return { ok: true, signedUrl: signed.signedUrl, path: signed.path };
}

export async function deleteScanToTaskUploadsAction(
  orgId: string,
  _prevState: { ok: true } | { ok: false; error: string } | null,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const parsed = deleteUploadsSchema.safeParse({
    storagePaths: formData.getAll("storagePaths").filter((value): value is string => typeof value === "string"),
  });
  if (!parsed.success) return { ok: false, error: "Nothing to delete." };

  await cleanupUploads(parsed.data.storagePaths);
  return { ok: true };
}

export async function scanToTaskAction(
  orgId: string,
  _prevState: ScanToTaskActionState | null,
  formData: FormData,
): Promise<ScanToTaskActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const instruction = normalizeInstruction(formData.get("instruction"));
  const sourceValues = formData.getAll("sources");
  const sources = sourceValues
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      try {
        return scanSourceSchema.parse(JSON.parse(value));
      } catch {
        return null;
      }
    })
    .filter((value): value is z.infer<typeof scanSourceSchema> => value !== null);

  if (sources.length === 0) {
    return { ok: false, error: "Upload at least one file." };
  }
  if (sources.length > MAX_FILES) {
    return { ok: false, error: `Upload at most ${MAX_FILES} files at a time.` };
  }

  const results: ScanToTaskResultItem[] = [];

  for (const source of sources) {
    const fileKind = getScanSourceKind(source.fileName, source.mimeType);

    try {
      const draft = await inferScanTaskDraftFromStorage(
        source.storagePath,
        source.fileName,
        source.mimeType,
        instruction,
      );

      results.push({
        ok: true,
        fileName: source.fileName,
        fileKind,
        draft,
      });
    } catch (error) {
      results.push({
        ok: false,
        fileName: source.fileName,
        fileKind,
        error: error instanceof Error ? error.message : "Failed to scan file.",
      });
    } finally {
      await deleteStorageFile(source.storagePath);
    }
  }

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);

  return { ok: true, results };
}

export async function confirmScanToTaskAction(
  orgId: string,
  _prevState: ConfirmScanToTaskActionState | null,
  formData: FormData,
): Promise<ConfirmScanToTaskActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const parsed = confirmScanToTaskSchema.safeParse({
    resultId: formData.get("resultId"),
    fileName: formData.get("fileName"),
    title: formData.get("title"),
    description: formData.get("description"),
    summary: formData.get("summary"),
    durationMin: formData.get("durationMin"),
    peopleRequired: formData.get("peopleRequired"),
    minWaitDays: formData.get("minWaitDays"),
    maxWaitDays: formData.get("maxWaitDays"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Fix the task details before confirming." };
  }

  const demoCheck = await checkDemoLimit(auth.userEmail, "task", orgId);
  if (!demoCheck.ok) return { ok: false, error: demoCheck.error };

  const creator = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  const task = await createTask(
    orgId,
    {
      title: parsed.data.title,
      description: [parsed.data.description, `Source file: ${parsed.data.fileName}`]
        .filter(Boolean)
        .join("\n\n"),
      color: colorFromSeed(`${parsed.data.fileName}:${parsed.data.title}`),
      durationMin: parsed.data.durationMin,
      peopleRequired: parsed.data.peopleRequired,
      minWaitDays: parsed.data.minWaitDays,
      maxWaitDays: parsed.data.maxWaitDays,
    },
    auth.userId,
    auth.userEmail,
    creator?.name ?? null,
  );

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);

  return {
    ok: true,
    resultId: parsed.data.resultId,
    taskId: task.id,
    taskHref: `/orgs/${orgId}/tasks/${task.id}`,
  };
}
