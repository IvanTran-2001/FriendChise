"use server";

import { PermissionAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createTask } from "@/lib/services/tasks";
import {
  getScanSourceKind,
  inferScanTaskDraftsFromStorage,
  type ScanTaskDraft,
} from "@/lib/ai/scan-to-task";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  buildTempUploadPath,
  cleanupUploads,
  colorFromSeed,
  normalizeInstruction,
} from "@/lib/services/scan-to-task";
import {
  confirmScanToTaskSchema,
  deleteUploadsSchema,
  getUploadUrlSchema,
  type ScanSourceInput,
  scanSourceSchema,
} from "@/lib/validators/scan-to-task";
import { prisma } from "@/lib/platform/prisma";
import { requireOrgPermissionAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import {
  createSignedUploadUrl,
  deleteStorageFile,
} from "@/lib/platform/supabase-storage";

export type ScanToTaskUploadUrlActionState =
  | { ok: true; signedUrl: string; path: string }
  | { ok: false; error: string };

export type ScanToTaskResultItem =
  | {
      ok: true;
      fileName: string;
      fileKind: string;
      fileSize: number;
      draft: ScanTaskDraft;
    }
  | {
      ok: false;
      fileName: string;
      fileKind: string;
      fileSize: number;
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

/**
 * Creates a signed upload URL for a temporary scan file.
 * The client uploads the selected file directly to storage, then passes the
 * resulting path back into the scan action.
 */
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

/**
 * Deletes one or more temporary upload objects.
 * Used both for explicit cleanup and for rollback after an upload or scan fails.
 */
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

/**
 * Scans uploaded files into draft task suggestions.
 * The action never creates tasks directly; it only returns draft data and removes
 * the temporary upload objects after processing each file.
 */
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
    .filter((value): value is ScanSourceInput => value !== null);

  if (sources.length === 0) {
    return { ok: false, error: "Upload at least one file." };
  }
  if (sources.length > MAX_FILES) {
    return { ok: false, error: `Upload at most ${MAX_FILES} files at a time.` };
  }

  const demoCheck = await checkDemoLimit(auth.userEmail, "scan", orgId, auth.userId);
  if (!demoCheck.ok) return { ok: false, error: demoCheck.error };

  const results: ScanToTaskResultItem[] = [];

  for (const source of sources) {
    const fileKind = getScanSourceKind(source.fileName, source.mimeType);

    try {
      const drafts = await inferScanTaskDraftsFromStorage(
        source.storagePath,
        source.fileName,
        source.mimeType,
        instruction,
      );

      for (const draft of drafts) {
        results.push({
          ok: true,
          fileName: source.fileName,
          fileKind,
          fileSize: source.fileSize,
          draft,
        });
      }
    } catch (error) {
      results.push({
        ok: false,
        fileName: source.fileName,
        fileKind,
        fileSize: source.fileSize,
        error: error instanceof Error ? error.message : "Failed to scan file.",
      });
    } finally {
      await deleteStorageFile(source.storagePath);
    }
  }

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);

  return { ok: true, results };
}

/**
 * Confirms one reviewed draft and creates the real task record.
 * The submitted form contains the user's edits, which are validated and then
 * forwarded to the shared task creation service.
 */
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
