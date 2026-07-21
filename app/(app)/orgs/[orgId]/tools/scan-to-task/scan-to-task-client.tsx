"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  confirmScanToTaskAction,
  deleteScanToTaskUploadsAction,
  getScanToTaskUploadUrlAction,
  scanToTaskAction,
} from "@/app/actions/tools/scan-to-task";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { getScanToTaskUploadContentType, resolveScanUploadMimeType } from "@/lib/services/scan-to-task-shared";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ScanToTaskUploadSection } from "./_components/scan-to-task-upload-section";
import { ScanToTaskResultsSection, type DraftScanResultItem } from "./_components/scan-to-task-results-section";
import { ScanToTaskInspector } from "./_components/scan-to-task-inspector";

type ViewMode = "feed" | "list";
type ScanSourceRef = { storagePath: string; fileName: string; mimeType: string; fileSize: number };

function createScanResultClientId(resultIndex: number, fileName: string, ok: boolean) {
  return `${Date.now()}:${crypto.randomUUID()}:${resultIndex}:${fileName}:${ok ? "ready" : "error"}`;
}

export function ScanToTaskClient({ orgId }: { orgId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = usePersistedState<ViewMode>(`scan-to-task:${orgId}:view`, "feed", { broadcast: true });
  const [selectedResultId, setSelectedResultId] = usePersistedState<string | null>(`scan-to-task:${orgId}:selected-result`, null, {
    broadcast: false,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [instructionText, setInstructionText] = usePersistedState<string>(`scan-to-task:${orgId}:instruction`, "", {
    broadcast: false,
  });
  const [scannedResults, setScannedResults] = usePersistedState<DraftScanResultItem[]>(`scan-to-task:${orgId}:results`, [], {
    broadcast: false,
  });
  const [draftsById, setDraftsById] = usePersistedState<Record<string, ScanTaskDraft>>(`scan-to-task:${orgId}:drafts`, {}, {
    broadcast: false,
  });
  const [confirmedTasksById, setConfirmedTasksById] = useState<Record<string, { taskId: string; taskHref: string }>>({});
  const [scanPending, setScanPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  const selectedResult = scannedResults.find((result) => result.clientId === selectedResultId) ?? scannedResults[0] ?? null;
  const selectedDraft = selectedResult && selectedResult.ok ? draftsById[selectedResult.clientId] : null;
  const selectedTask = selectedResult ? confirmedTasksById[selectedResult.clientId] : null;
  const emptySelectedLabel = scanPending
    ? "Scanning files…"
    : selectedFiles.length > 0
      ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} queued for review`
      : "Upload files to start";

  const removeResultFromQueue = (resultId: string) => {
    const nextResults = scannedResults.filter((result) => result.clientId !== resultId);
    const nextDrafts = Object.fromEntries(Object.entries(draftsById).filter(([draftId]) => draftId !== resultId));
    const nextConfirmed = Object.fromEntries(Object.entries(confirmedTasksById).filter(([confirmedId]) => confirmedId !== resultId));

    setScannedResults(nextResults);
    setDraftsById(nextDrafts);
    setConfirmedTasksById(nextConfirmed);

    if (selectedResultId === resultId) {
      const nextSelectedResult = nextResults.find((result) => result.ok) ?? nextResults[0] ?? null;
      setSelectedResultId(nextSelectedResult ? nextSelectedResult.clientId : null);
    }
  };

  const cleanupUploads = async (storagePaths: string[]) => {
    if (storagePaths.length === 0) return;
    const cleanupFormData = new FormData();
    for (const storagePath of storagePaths) {
      cleanupFormData.append("storagePaths", storagePath);
    }
    await deleteScanToTaskUploadsAction(orgId, null, cleanupFormData);
  };

  const uploadSelectedFiles = async (): Promise<ScanSourceRef[]> => {
    const uploadedSources: ScanSourceRef[] = [];
    for (const file of selectedFiles) {
      const resolvedMimeType = resolveScanUploadMimeType(file.name, file.type || "application/octet-stream");
      const uploadFormData = new FormData();
      uploadFormData.set("fileName", file.name);
      uploadFormData.set("mimeType", resolvedMimeType);
      const uploadContentType = getScanToTaskUploadContentType(resolvedMimeType);

      const uploadState = await getScanToTaskUploadUrlAction(orgId, null, uploadFormData);
      if (!uploadState.ok) {
        throw new Error(uploadState.error);
      }

      const uploadResponse = await fetch(uploadState.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": uploadContentType },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload "${file.name}".`);
      }

      uploadedSources.push({
        storagePath: uploadState.path,
        fileName: file.name,
        mimeType: resolvedMimeType,
        fileSize: file.size,
      });
    }

    return uploadedSources;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error("Upload at least one file.");
      return;
    }

    const instruction = new FormData(event.currentTarget).get("instruction")?.toString().trim() ?? "";
    setScanPending(true);

    let uploadedSources: ScanSourceRef[] = [];

    try {
      uploadedSources = await uploadSelectedFiles();

      const formData = new FormData();
      if (instruction) formData.set("instruction", instruction);
      for (const source of uploadedSources) {
        formData.append("sources", JSON.stringify(source));
      }

      const nextState = await scanToTaskAction(orgId, null, formData);
      if (!nextState.ok) {
        await cleanupUploads(uploadedSources.map((source) => source.storagePath));
        toast.error(nextState.error);
        return;
      }

      const nextResults: DraftScanResultItem[] = nextState.results.map((result, index) => ({
        ...result,
        clientId: createScanResultClientId(index, result.fileName, result.ok),
      }));
      const nextDrafts = Object.fromEntries(
        nextResults
          .filter((result): result is Extract<DraftScanResultItem, { ok: true }> => result.ok)
          .map((result) => [result.clientId, result.draft]),
      );

      const readyCount = nextResults.filter((result) => result.ok).length;
      const failedCount = nextResults.length - readyCount;
      toast.success(
        failedCount > 0
          ? `Scanned ${readyCount} draft${readyCount === 1 ? "" : "s"}; ${failedCount} draft${failedCount === 1 ? "" : "s"} need attention.`
          : `Scanned ${readyCount} draft${readyCount === 1 ? "" : "s"}; ready to confirm.`,
      );

      const mergedResults = [...scannedResults, ...nextResults];
      const firstNewResult = nextResults.find((result) => result.ok) ?? nextResults[0] ?? null;

      if (firstNewResult) {
        setSelectedResultId(firstNewResult.clientId);
      }

      setScannedResults(mergedResults);
      setDraftsById((current) => ({ ...current, ...nextDrafts }));
      formRef.current?.reset();
      setInstructionText("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      await cleanupUploads(uploadedSources.map((source) => source.storagePath));
      toast.error(error instanceof Error ? error.message : "Failed to scan files.");
    } finally {
      setScanPending(false);
    }
  };

  const handleConfirmSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setConfirmPending(true);

    try {
      const nextState = await confirmScanToTaskAction(orgId, null, formData);
      if (!nextState.ok) {
        toast.error(nextState.error);
        return;
      }

      removeResultFromQueue(nextState.resultId);
      toast.success("Task created.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleRejectResult = (resultId: string) => {
    removeResultFromQueue(resultId);
    toast.success("Removed from the list.");
  };

  const handleDraftChange = (resultId: string, patch: Partial<ScanTaskDraft>) => {
    setDraftsById((current) => {
      const existing = current[resultId];
      if (!existing) return current;
      return { ...current, [resultId]: { ...existing, ...patch } };
    });
  };

  const confirmedCount = scannedResults.filter((result) => result.ok && confirmedTasksById[result.clientId]).length;
  const readyCount = scannedResults.filter((result) => result.ok && !confirmedTasksById[result.clientId]).length;
  const failedCount = scannedResults.filter((result) => !result.ok).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <section className="min-w-0 rounded-2xl border border-border/60 bg-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Scan to Task</span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Turn documents into task items
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Upload PDFs, images, and docs — AI drafts the task, you review and confirm.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2 lg:w-90">
            <div className="rounded-xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                In review
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{readyCount}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                Confirmed
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{confirmedCount}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-background px-2.5 py-2.5 sm:px-4 sm:py-3">
              <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px] sm:tracking-[0.16em]">
                Failed
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">{failedCount}</div>
            </div>
          </div>
        </div>
      </section>

      <ScanToTaskUploadSection
        formRef={formRef}
        fileInputRef={fileInputRef}
        selectedFiles={selectedFiles}
        scanPending={scanPending}
        instructionText={instructionText}
        onInstructionChange={setInstructionText}
        onSubmit={handleSubmit}
        onFilesChange={(files) => setSelectedFiles(files)}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ScanToTaskResultsSection
          results={scannedResults}
          view={view}
          loading={scanPending}
          emptySelectedLabel={emptySelectedLabel}
          selectedResultId={selectedResultId}
          confirmedTasksById={confirmedTasksById}
          onSelectResult={setSelectedResultId}
          onViewChange={setView}
        />

        <ScanToTaskInspector
          selectedResult={selectedResult}
          selectedDraft={selectedDraft}
          selectedTask={selectedTask ?? null}
          confirmPending={confirmPending}
          onConfirmSubmit={handleConfirmSubmit}
          onDraftChange={handleDraftChange}
          onReject={selectedResult ? () => handleRejectResult(selectedResult.clientId) : null}
        />
      </div>
    </div>
  );
}
