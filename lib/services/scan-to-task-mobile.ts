import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/prisma";
import { log } from "@/lib/platform/observability";
import { deleteStorageFile } from "@/lib/platform/supabase-storage";
import { getScanSourceKind } from "@/lib/services/scan-to-task-shared";
import { inferScanTaskDraftsFromStorage, type ScanTaskDraft } from "@/lib/ai/scan-to-task";
import type { ScanSourceInput } from "@/lib/validators/scan-to-task";

export type MobileScanResultItem =
  | {
      ok: true;
      resultId: string;
      fileName: string;
      fileKind: string;
      fileSize: number;
      draft: ScanTaskDraft;
    }
  | {
      ok: false;
      resultId: string;
      fileName: string;
      fileKind: string;
      fileSize: number;
      error: string;
    };

/**
 * Scans one uploaded source into draft task suggestions and persists a
 * `ScanTaskResult` row per draft, matching the shape the web scanner writes
 * so both clients share the same history table.
 *
 * This mirrors `processScanSource` in `app/actions/tools/s2t.ts` but skips
 * the AI duplicate-adjudication pass (a web-only enhancement) to keep the
 * mobile scan path simple.
 */
async function processMobileScanSource(
  orgId: string,
  createdById: string | null,
  batchId: string,
  source: ScanSourceInput,
  instruction: string,
): Promise<MobileScanResultItem[]> {
  const fileKind = getScanSourceKind(source.fileName, source.mimeType);

  try {
    const drafts = await inferScanTaskDraftsFromStorage(
      source.storagePath,
      source.fileName,
      source.mimeType,
      instruction,
    );

    const draftRows = drafts.map((draft) => ({ resultId: randomUUID(), draft }));

    if (draftRows.length > 0) {
      await prisma.scanTaskResult.createMany({
        data: draftRows.map((row) => ({
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
          metadata: Prisma.JsonNull,
          taskId: null,
          confirmedAt: null,
          clearedAt: null,
        })),
      });
    }

    return draftRows.map((row) => ({
      ok: true,
      resultId: row.resultId,
      fileName: source.fileName,
      fileKind,
      fileSize: source.fileSize,
      draft: row.draft,
    }));
  } catch (error) {
    const resultId = randomUUID();
    const message = error instanceof Error ? error.message : "Failed to scan file.";
    log.error("Failed to scan source into drafts", {
      orgId,
      storagePath: source.storagePath,
      error,
    });
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
        error: message,
        metadata: Prisma.JsonNull,
        taskId: null,
        confirmedAt: null,
        clearedAt: null,
      },
    });
    return [{ ok: false, resultId, fileName: source.fileName, fileKind, fileSize: source.fileSize, error: message }];
  } finally {
    const deleted = await deleteStorageFile(source.storagePath);
    if (!deleted.ok) {
      log.error("Failed to delete uploaded scan file after processing", {
        orgId,
        storagePath: source.storagePath,
        error: deleted.error,
      });
    }
  }
}

/**
 * Runs the mobile scan-to-task pipeline for one or more uploaded sources.
 */
export async function runMobileScanToTask(
  orgId: string,
  createdById: string | null,
  sources: ScanSourceInput[],
  instruction: string,
): Promise<MobileScanResultItem[]> {
  const batchId = randomUUID();
  const results: MobileScanResultItem[] = [];

  for (const source of sources) {
    results.push(...(await processMobileScanSource(orgId, createdById, batchId, source, instruction)));
  }

  return results;
}
