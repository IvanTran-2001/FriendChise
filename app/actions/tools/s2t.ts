"use server";

import { PermissionAction, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { findTaskByName } from "@/lib/services/tasks";
import {
  inferScanTaskDraftsFromStorage,
  type ScanTaskDraft,
} from "@/lib/ai/scan-to-task";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  SCAN_UPLOAD_PREFIX,
  buildTempUploadPath,
  cleanupUploads,
  colorFromSeed,
  normalizeInstruction,
} from "@/lib/services/scan-to-task";
import { getScanSourceKind } from "@/lib/services/scan-to-task-shared";
import {
  confirmScanToTaskSchema,
  deleteUploadsSchema,
  getUploadUrlSchema,
  scanTaskDraftSchema,
  type ScanTaskResultMetadata,
  type ScanSourceInput,
  scanSourceSchema,
} from "@/lib/validators/scan-to-task";
import { prisma } from "@/lib/platform/prisma";
import { log } from "@/lib/platform/observability";
import { requireOrgPermissionAction, requireParentOrgOwnerAction } from "@/lib/authz";
import { checkDemoLimit } from "@/lib/demo";
import { createTaskOnClient, deleteTask } from "@/lib/services/tasks";
import { recordAudit } from "@/lib/services/audit-log";
import { mergeScanToTaskConflictItems } from "@/lib/ai/scan-to-task/s2t-merge";
import { adjudicateScanTaskDuplicate, createDuplicateAdjudicationBudget } from "@/lib/ai/scan-to-task/s2t-batch";
import {
  getTaskDuplicateCandidateKey,
  getTaskOwnerOrgId,
  loadPotentialTaskDuplicateCandidates,
  scorePotentialTaskDuplicates,
} from "@/lib/services/tasks";
import {
  createSignedUploadUrl,
  deleteStorageFile,
} from "@/lib/platform/supabase-storage";

const SCAN_TO_TASK_CONCURRENCY = 4;

function assertOwnedStoragePath(orgId: string, storagePath: string) {
  const expectedPrefix = `orgs/${orgId}/${SCAN_UPLOAD_PREFIX}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("Storage path does not belong to this organization.");
  }

  const relativePath = storagePath.slice(expectedPrefix.length);
  const pathSegments = relativePath.split("/");
  if (pathSegments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("Storage path does not belong to this organization.");
  }
}

async function buildDuplicateCandidateVerdicts(
  draft: ScanTaskDraft,
  candidates: Awaited<ReturnType<typeof loadPotentialTaskDuplicateCandidates>>,
  budget: ReturnType<typeof createDuplicateAdjudicationBudget>,
) {
  const selectedCandidates = scorePotentialTaskDuplicates(
    {
      title: draft.title,
      description: draft.description,
      sourceText: draft.sourceText || undefined,
    },
    candidates,
    { limit: 3, threshold: 0.82 },
  );

  const verdictEntries = await Promise.all(
    selectedCandidates.map(async (candidate) => {
      if (!budget.takeAttempt()) return null;

      const adjudication = await adjudicateScanTaskDuplicate(
        {
          title: draft.title,
          summary: draft.summary,
          description: draft.description,
          sourceText: draft.sourceText,
          importantDetails: [],
          actionItems: [],
        },
        candidate,
        budget,
      );

      if (!adjudication) return null;
      return [getTaskDuplicateCandidateKey(candidate), adjudication.sameTask] as const;
    }),
  );

  const nextVerdicts = Object.fromEntries(verdictEntries.filter(Boolean) as Array<readonly [string, boolean]>);
  return Object.keys(nextVerdicts).length > 0 ? nextVerdicts : null;
}

async function processScanSource(
  orgId: string,
  createdById: string | null,
  batchId: string,
  source: ScanSourceInput,
  instruction: string,
): Promise<ScanToTaskResultItem[]> {
  const fileKind = getScanSourceKind(source.fileName, source.mimeType);

  try {
    const drafts = await inferScanTaskDraftsFromStorage(
      source.storagePath,
      source.fileName,
      source.mimeType,
      instruction,
    );

    const duplicateCandidates = await loadPotentialTaskDuplicateCandidates(orgId);
    const duplicateAdjudicationBudget = createDuplicateAdjudicationBudget({ maxAttempts: 60, maxConcurrency: 3 });

    const draftRows = await Promise.all(
      drafts.map(async (draft) => ({
        resultId: randomUUID(),
        draft,
        duplicateCandidateVerdicts: await buildDuplicateCandidateVerdicts(draft, duplicateCandidates, duplicateAdjudicationBudget),
      })),
    );

    await prisma.$transaction(async (tx) => {
      for (const row of draftRows) {
        await tx.scanTaskResult.create({
          data: {
            id: row.resultId,
            orgId,
            createdById,
            batchId,
            fileName: source.fileName,
            fileKind,
            fileSize: source.fileSize,
            instruction,
            draft: row.draft,
            error: null,
            metadata: row.duplicateCandidateVerdicts
              ? { duplicateCandidateVerdicts: row.duplicateCandidateVerdicts }
              : Prisma.JsonNull,
            taskId: null,
            confirmedAt: null,
            clearedAt: null,
          },
        });
      }
    });

    return draftRows.map((row) => ({
      ok: true,
      resultId: row.resultId,
      fileName: source.fileName,
      fileKind,
      fileSize: source.fileSize,
      draft: row.draft,
      metadata: row.duplicateCandidateVerdicts
        ? { duplicateCandidateVerdicts: row.duplicateCandidateVerdicts }
        : null,
    } satisfies ScanToTaskResultItem));
  } catch (error) {
    const resultId = randomUUID();
    await prisma.scanTaskResult.create({
      data: {
        id: resultId,
        orgId,
        createdById,
        batchId,
        fileName: source.fileName,
        fileKind,
        fileSize: source.fileSize,
        instruction,
        draft: Prisma.JsonNull,
        error: error instanceof Error ? error.message : "Failed to scan file.",
        metadata: Prisma.JsonNull,
        taskId: null,
        confirmedAt: null,
        clearedAt: null,
      },
    });
    return [
      {
        ok: false,
        resultId,
        fileName: source.fileName,
        fileKind,
        fileSize: source.fileSize,
        error: error instanceof Error ? error.message : "Failed to scan file.",
      },
    ];
  } finally {
    try {
      await deleteStorageFile(source.storagePath);
    } catch (error) {
      log.error("Failed to delete uploaded scan file after processing", {
        orgId,
        storagePath: source.storagePath,
        error,
      });
    }
  }
}

export type ScanToTaskUploadUrlActionState =
  | { ok: true; signedUrl: string; path: string }
  | { ok: false; error: string };

export type ScanToTaskResultItem =
  | {
      ok: true;
      resultId: string;
      taskId?: string | null;
      metadata?: ScanTaskResultMetadata | null;
      fileName: string;
      fileKind: string;
      fileSize: number;
      draft: ScanTaskDraft;
    }
  | {
      ok: false;
      resultId: string;
      taskId?: string | null;
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

export type ClearScanToTaskResultActionState =
  | { ok: true }
  | { ok: false; error: string };

export type UpdateScanToTaskDraftActionState =
  | {
      ok: true;
      resultId: string;
      draft: ScanTaskDraft;
    }
  | { ok: false; error: string };

export type DeleteScanToTaskConflictItemsActionState =
  | { ok: true }
  | { ok: false; error: string };

export type MergeScanToTaskConflictItemsActionState =
  | {
      ok: true;
      result: {
        ok: true;
        resultId: string;
        taskId?: string | null;
        metadata?: ScanTaskResultMetadata | null;
        batchId: string;
        fileName: string;
        fileKind: string;
        fileSize: number;
        draft: ScanTaskDraft;
      };
    }
  | { ok: false; error: string };

type MergeSourcePruneInput = {
  resultIds?: string[];
  taskIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pruneMergedSourceMetadata(
  metadata: unknown,
  { resultIds = [], taskIds = [] }: MergeSourcePruneInput,
): ScanTaskResultMetadata | typeof Prisma.JsonNull | null {
  if (!isRecord(metadata)) return null;

  const nextMetadata = { ...metadata } as Record<string, unknown>;
  let changed = false;

  const mergedFromResultIds = Array.isArray(metadata.mergedFromResultIds)
    ? metadata.mergedFromResultIds.filter((value): value is string => typeof value === "string" && !resultIds.includes(value))
    : [];
  if (Array.isArray(metadata.mergedFromResultIds)) {
    if (mergedFromResultIds.length > 0) {
      nextMetadata.mergedFromResultIds = mergedFromResultIds;
    } else {
      delete nextMetadata.mergedFromResultIds;
    }
    if (mergedFromResultIds.length !== metadata.mergedFromResultIds.length) {
      changed = true;
    }
  }

  const mergedFromTaskIds = Array.isArray(metadata.mergedFromTaskIds)
    ? metadata.mergedFromTaskIds.filter((value): value is string => typeof value === "string" && !taskIds.includes(value))
    : [];
  if (Array.isArray(metadata.mergedFromTaskIds)) {
    if (mergedFromTaskIds.length > 0) {
      nextMetadata.mergedFromTaskIds = mergedFromTaskIds;
    } else {
      delete nextMetadata.mergedFromTaskIds;
    }
    if (mergedFromTaskIds.length !== metadata.mergedFromTaskIds.length) {
      changed = true;
    }
  }

  if (!changed) return null;

  return Object.keys(nextMetadata).length > 0 ? (nextMetadata as ScanTaskResultMetadata) : Prisma.JsonNull;
}

async function pruneMergedSourceReferences(
  orgId: string,
  pruneInput: MergeSourcePruneInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const resultIds = [...new Set(pruneInput.resultIds ?? [])];
  const taskIds = [...new Set(pruneInput.taskIds ?? [])];
  if (resultIds.length === 0 && taskIds.length === 0) return;

  const rows = await db.scanTaskResult.findMany({
    where: { orgId, clearedAt: null, taskId: null, metadata: { not: Prisma.JsonNull } },
    select: { id: true, metadata: true },
  });

  await Promise.all(
    rows
      .filter((row) => !resultIds.includes(row.id))
      .filter((row) =>
        isRecord(row.metadata) &&
        (Array.isArray(row.metadata.mergedFromResultIds) || Array.isArray(row.metadata.mergedFromTaskIds)),
      )
      .map(async (row) => {
        const nextMetadata = pruneMergedSourceMetadata(row.metadata, { resultIds, taskIds });
        if (nextMetadata === null) return;

        await db.scanTaskResult.update({
          where: { id: row.id },
          data: { metadata: nextMetadata },
        });
      }),
  );
}

/**
 * Deletes a task linked from scan-to-task and prunes merged source references
 * inside the same transaction.
 */
export async function deleteScanToTaskLinkedTaskAction(
  orgId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const taskOrgId = await getTaskOwnerOrgId(taskId);
  if (!taskOrgId) return { ok: false, error: "Task not found." };

  const [franchiseAuthz, taskOrgAuthz] = await Promise.all([
    requireParentOrgOwnerAction(orgId),
    requireOrgPermissionAction(taskOrgId, PermissionAction.MANAGE_TASKS),
  ]);
  if (!franchiseAuthz.ok && !taskOrgAuthz.ok) {
    return { ok: false, error: "Unauthorized." };
  }

  const authz = franchiseAuthz.ok
    ? { userId: franchiseAuthz.userId, userEmail: franchiseAuthz.userEmail }
    : { userId: taskOrgAuthz.userId, userEmail: taskOrgAuthz.userEmail };

  const existingTask = await prisma.task.findFirst({
    where: { id: taskId, orgId: taskOrgId },
    select: { name: true, color: true, description: true, durationMin: true },
  });
  if (!existingTask) return { ok: false, error: "Task not found." };

  try {
    await prisma.$transaction(async (tx) => {
      const deleteResult = await deleteTask(taskOrgId, taskId, authz.userId, authz.userEmail, tx);
      if (!deleteResult.ok) {
        throw new Error(deleteResult.error);
      }

      await pruneMergedSourceReferences(orgId, { taskIds: [taskId] }, tx);

      await recordAudit(
        {
          orgId: taskOrgId,
          actorId: authz.userId,
          actorEmail: authz.userEmail,
          action: "task.delete",
          targetType: "Task",
          targetId: taskId,
          before: existingTask,
        },
        tx,
      );
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to delete task.",
    };
  }

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);
  return { ok: true };
}

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

  for (const storagePath of parsed.data.storagePaths) {
    try {
      assertOwnedStoragePath(orgId, storagePath);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid upload path.",
      };
    }
  }

  await cleanupUploads(parsed.data.storagePaths);
  return { ok: true };
}

/**
 * Clears a scan result from the visible queue without deleting the row.
 */
export async function clearScanToTaskResultAction(
  orgId: string,
  _prevState: ClearScanToTaskResultActionState | null,
  formData: FormData,
): Promise<ClearScanToTaskResultActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const resultId = formData.get("resultId");
  if (typeof resultId !== "string" || !resultId.trim()) {
    return { ok: false, error: "Missing scan result." };
  }

  const result = await prisma.scanTaskResult.findFirst({
    where: { id: resultId, orgId },
    select: { id: true },
  });
  if (!result) {
    return { ok: false, error: "Scan result not found." };
  }

  await prisma.scanTaskResult.update({
    where: { id: result.id },
    data: { clearedAt: new Date() },
  });

  await pruneMergedSourceReferences(orgId, { resultIds: [result.id] });

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);
  return { ok: true };
}

/**
 * Persists edits to an existing scan draft row so inspector changes survive refreshes.
 */
export async function updateScanToTaskDraftAction(
  orgId: string,
  _prevState: UpdateScanToTaskDraftActionState | null,
  formData: FormData,
): Promise<UpdateScanToTaskDraftActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const parsed = confirmScanToTaskSchema.safeParse({
    resultId: formData.get("resultId"),
    fileName: formData.get("fileName"),
    color: formData.get("color"),
    title: formData.get("title"),
    description: formData.get("description"),
    summary: formData.get("summary"),
    sourceText: formData.get("sourceText"),
    durationMin: formData.get("durationMin"),
    peopleRequired: formData.get("peopleRequired"),
    minWaitDays: formData.get("minWaitDays"),
    maxWaitDays: formData.get("maxWaitDays"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Fix the task details before saving." };
  }

  const result = await prisma.scanTaskResult.findFirst({
    where: { id: parsed.data.resultId, orgId, taskId: null, clearedAt: null },
    select: { id: true, draft: true },
  });
  if (!result || !result.draft || typeof result.draft !== "object") {
    return { ok: false, error: "Scan result not found." };
  }

  const existingDraft = scanTaskDraftSchema.safeParse(result.draft);
  if (!existingDraft.success) {
    return { ok: false, error: "Scan draft is no longer available." };
  }

  const nextDraft = scanTaskDraftSchema.parse({
    ...existingDraft.data,
    color: parsed.data.color ?? existingDraft.data.color,
    title: parsed.data.title,
    description: parsed.data.description,
    durationMin: parsed.data.durationMin,
    peopleRequired: parsed.data.peopleRequired,
    minWaitDays: parsed.data.minWaitDays,
    maxWaitDays: parsed.data.maxWaitDays,
  });

  await prisma.scanTaskResult.update({
    where: { id: result.id },
    data: { draft: nextDraft },
  });

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);
  return { ok: true, resultId: result.id, draft: nextDraft };
}

/**
 * Clears selected draft results and removes any selected duplicate tasks.
 */
export async function deleteScanToTaskConflictItemsAction(
  orgId: string,
  _prevState: DeleteScanToTaskConflictItemsActionState | null,
  formData: FormData,
): Promise<DeleteScanToTaskConflictItemsActionState> {
  try {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const resultIds = formData.getAll("resultIds").filter((value): value is string => typeof value === "string");
  const taskIds = formData.getAll("taskIds").filter((value): value is string => typeof value === "string");

  if (resultIds.length === 0 && taskIds.length === 0) {
    return { ok: false, error: "Select at least one draft or task to delete." };
  }

  await prisma.$transaction(async (tx) => {
    if (resultIds.length > 0) {
      await tx.scanTaskResult.updateMany({
        where: { orgId, id: { in: resultIds } },
        data: { clearedAt: new Date() },
      });
    }

    for (const taskId of taskIds) {
      const deletedTask = await tx.task.findFirst({
        where: { id: taskId, orgId },
        select: { name: true, color: true, description: true, durationMin: true },
      });
      const result = await deleteTask(orgId, taskId, auth.userId, auth.userEmail, tx);
      if (!result.ok) {
        throw new Error(result.error);
      }

      if (deletedTask) {
        await recordAudit(
          {
            orgId,
            actorId: auth.userId,
            actorEmail: auth.userEmail,
            action: "task.delete",
            targetType: "Task",
            targetId: taskId,
            before: deletedTask,
          },
          tx,
        );
      }
    }
  });

  await pruneMergedSourceReferences(orgId, { resultIds, taskIds });

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);
  return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to delete selected items.",
    };
  }
}

/**
 * Merges selected conflict items into a new scan draft row.
 */
export async function mergeScanToTaskConflictItemsAction(
  orgId: string,
  _prevState: MergeScanToTaskConflictItemsActionState | null,
  formData: FormData,
): Promise<MergeScanToTaskConflictItemsActionState> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const resultIds = formData.getAll("resultIds").filter((value): value is string => typeof value === "string");
  const taskIds = formData.getAll("taskIds").filter((value): value is string => typeof value === "string");
  const instructionValue = formData.get("instruction");
  const instruction = typeof instructionValue === "string" ? instructionValue.trim() : "";

  if (resultIds.length === 0) {
    return { ok: false, error: "Select at least one draft to merge." };
  }

  const drafts = await prisma.scanTaskResult.findMany({
    where: { orgId, id: { in: resultIds }, clearedAt: null },
    select: {
      id: true,
      batchId: true,
      fileName: true,
      fileKind: true,
      fileSize: true,
      draft: true,
      metadata: true,
    },
  });

  const taskRows = taskIds.length > 0
    ? await prisma.task.findMany({
        where: { orgId, id: { in: taskIds } },
        select: { id: true, name: true, description: true, durationMin: true, minPeople: true, maxPeople: true },
      })
    : [];

  const parsedDrafts = drafts
    .map((row) => {
      const parsed = scanTaskDraftSchema.safeParse(row.draft);
      return parsed.success
        ? {
            title: parsed.data.title,
            description: parsed.data.description,
            summary: parsed.data.summary,
            sourceText: parsed.data.sourceText,
          }
        : null;
    })
    .filter((value): value is { title: string; description: string; summary: string; sourceText: string } => value !== null);

  const mergedSourceSnapshots = drafts.map((row) => {
    const parsed = scanTaskDraftSchema.safeParse(row.draft);
    return {
      id: row.id,
      fileName: row.fileName,
      title: parsed.success ? parsed.data.title : row.fileName,
    };
  });

  const mergedTaskSnapshots = taskRows.map((row) => ({
    id: row.id,
    name: row.name,
  }));

  const mergedDraft = await mergeScanToTaskConflictItems({ drafts: parsedDrafts, tasks: taskRows, instruction });
  if (!mergedDraft) {
    return { ok: false, error: "Failed to merge items." };
  }

  const sourceRow = drafts[0];
  if (!sourceRow) {
    return { ok: false, error: "Select at least one draft to merge." };
  }

  const mergedMetadata: ScanTaskResultMetadata = {
    mergedFromResultIds: drafts.map((row) => row.id),
    mergedFromResultSnapshots: mergedSourceSnapshots,
    mergedFromTaskIds: taskRows.map((row) => row.id),
    mergedFromTaskSnapshots: mergedTaskSnapshots,
  };

  const mergedResult = await prisma.$transaction(async (tx) => {
    const created = await tx.scanTaskResult.create({
      data: {
        orgId,
        createdById: auth.userId,
        batchId: sourceRow.batchId,
        fileName: sourceRow.fileName,
        fileKind: sourceRow.fileKind,
        fileSize: sourceRow.fileSize,
        instruction: null,
        draft: mergedDraft,
        error: null,
        metadata: mergedMetadata,
        taskId: null,
        confirmedAt: null,
        clearedAt: null,
      },
      select: {
        id: true,
        batchId: true,
        fileName: true,
        fileKind: true,
        fileSize: true,
        draft: true,
        metadata: true,
      },
    });

    await tx.scanTaskResult.updateMany({
      where: { orgId, id: { in: resultIds }, clearedAt: null },
      data: { clearedAt: new Date() },
    });

    return created;
  });

  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);

  return {
    ok: true,
    result: {
      ok: true,
      resultId: mergedResult.id,
      batchId: mergedResult.batchId,
      fileName: mergedResult.fileName,
      fileKind: mergedResult.fileKind,
      fileSize: mergedResult.fileSize,
      taskId: null,
      metadata: mergedMetadata,
      draft: mergedDraft,
    },
  };
}

/**
 * Removes draft/task source references from any merged scan draft metadata.
 * Used when a source draft or task is deleted so the parent merge draft stays
 * visible but no longer points at missing children.
 */
export async function pruneScanToTaskMergeSourceReferencesAction(
  orgId: string,
  _prevState: { ok: true } | { ok: false; error: string } | null,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireOrgPermissionAction(orgId, PermissionAction.MANAGE_TASKS);
  if (!auth.ok) return { ok: false, error: "Unauthorized" };

  const resultIds = formData.getAll("resultIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const taskIds = formData.getAll("taskIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  await pruneMergedSourceReferences(orgId, { resultIds, taskIds });
  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);
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

  const batchId = randomUUID();

  for (const source of sources) {
    try {
      assertOwnedStoragePath(orgId, source.storagePath);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid upload path.",
      };
    }
  }

  const resultsBySource: ScanToTaskResultItem[][] = Array.from({ length: sources.length }, () => []);
  let nextIndex = 0;
  const workerCount = Math.min(SCAN_TO_TASK_CONCURRENCY, sources.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < sources.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        resultsBySource[currentIndex] = await processScanSource(orgId, auth.userId, batchId, sources[currentIndex], instruction);
      }
    }),
  );

  const results = resultsBySource.flat();

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
    color: formData.get("color"),
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

  const duplicateTask = await findTaskByName(orgId, parsed.data.title);
  if (duplicateTask) {
    return {
      ok: false,
      error: `A task named "${duplicateTask.name}" already exists.`,
    };
  }

  const confirmationUnavailableError = "Scan result is no longer available.";
  const confirmedAt = new Date();

  let task;
  try {
    task = await prisma.$transaction(async (tx) => {
      const claimed = await tx.scanTaskResult.updateMany({
        where: {
          id: parsed.data.resultId,
          orgId,
          clearedAt: null,
          confirmedAt: null,
          taskId: null,
        },
        data: {
          confirmedAt,
          clearedAt: confirmedAt,
        },
      });

      if (claimed.count === 0) {
        throw new Error(confirmationUnavailableError);
      }

      const createdTask = await createTaskOnClient(
        tx,
        orgId,
        {
          color:
            typeof parsed.data.color === "string" && parsed.data.color
              ? parsed.data.color
              : colorFromSeed(`${parsed.data.fileName}:${parsed.data.title}`),
          title: parsed.data.title,
          description: [parsed.data.description, `Source file: ${parsed.data.fileName}`]
            .filter(Boolean)
            .join("\n\n"),
          durationMin: parsed.data.durationMin,
          peopleRequired: parsed.data.peopleRequired,
          minWaitDays: parsed.data.minWaitDays,
          maxWaitDays: parsed.data.maxWaitDays,
        },
        auth.userId,
        auth.userEmail,
        creator?.name ?? null,
      );

      await tx.scanTaskResult.update({
        where: { id: parsed.data.resultId },
        data: {
          taskId: createdTask.id,
          confirmedAt,
          clearedAt: confirmedAt,
        },
      });

      return createdTask;
    });
  } catch (error) {
    if (error instanceof Error && error.message === confirmationUnavailableError) {
      return { ok: false, error: confirmationUnavailableError };
    }

    if ((error as { code?: string } | null | undefined)?.code === "P2002") {
      return {
        ok: false,
        error: `A task named "${parsed.data.title}" already exists.`,
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to confirm draft.",
    };
  }

  log.info("Task created", { orgId, taskId: task.id });
  await recordAudit({
    orgId,
    actorId: auth.userId,
    actorEmail: auth.userEmail ?? null,
    action: "task.create",
    targetType: "Task",
    targetId: task.id,
    after: {
      name: task.name,
      color: task.color,
      description: task.description,
      durationMin: task.durationMin,
    },
  });

  revalidatePath(`/orgs/${orgId}/tasks`);
  revalidatePath(`/orgs/${orgId}/tools/scan-to-task`);

  return {
    ok: true,
    resultId: parsed.data.resultId,
    taskId: task.id,
    taskHref: `/orgs/${orgId}/tasks/${task.id}`,
  };
}
