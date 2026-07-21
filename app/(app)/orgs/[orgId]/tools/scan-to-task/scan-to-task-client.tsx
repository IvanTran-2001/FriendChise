"use client";

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/layout/sidebar/back-button";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";
import {
  confirmScanToTaskAction,
  deleteScanToTaskUploadsAction,
  getScanToTaskUploadUrlAction,
  scanToTaskAction,
} from "@/app/actions/tools/scan-to-task";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { ScanToTaskUploadSection } from "./_components/scan-to-task-upload-section";
import {
  ScanToTaskResultsSection,
  type DraftScanResultItem,
} from "./_components/scan-to-task-results-section";
import { ScanToTaskInspector } from "./_components/scan-to-task-inspector";

type ViewMode = "feed" | "list";
type ScanSourceRef = { storagePath: string; fileName: string; mimeType: string };

export function ScanToTaskClient({ orgId }: { orgId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<ViewMode>("feed");
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [scannedResults, setScannedResults] = useState<DraftScanResultItem[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, ScanTaskDraft>>({});
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
      const uploadFormData = new FormData();
      uploadFormData.set("fileName", file.name);
      uploadFormData.set("mimeType", file.type || "application/octet-stream");

      const uploadState = await getScanToTaskUploadUrlAction(orgId, null, uploadFormData);
      if (!uploadState.ok) {
        throw new Error(uploadState.error);
      }

      const uploadResponse = await fetch(uploadState.signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload "${file.name}".`);
      }

      uploadedSources.push({
        storagePath: uploadState.path,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
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
      if (instruction) {
        formData.set("instruction", instruction);
      }
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
        clientId: `${index}:${result.fileName}:${result.ok ? "ready" : "error"}`,
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
          ? `Scanned ${readyCount} file${readyCount === 1 ? "" : "s"}; ${failedCount} file${failedCount === 1 ? "" : "s"} need attention.`
          : `Scanned ${readyCount} file${readyCount === 1 ? "" : "s"}; ready to confirm.`,
      );

      if (nextResults.length > 0) {
        const firstReady = nextResults.find((result) => result.ok);
        setSelectedResultId(firstReady ? firstReady.clientId : nextResults[0].clientId);
      }

      setScannedResults(nextResults);
      setDraftsById(nextDrafts);
      setConfirmedTasksById({});
      formRef.current?.reset();
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

      setConfirmedTasksById((current) => ({
        ...current,
        [nextState.resultId]: {
          taskId: nextState.taskId,
          taskHref: nextState.taskHref,
        },
      }));
      toast.success("Task created and confirmed.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleDraftChange = (resultId: string, patch: Partial<ScanTaskDraft>) => {
    setDraftsById((current) => {
      const existing = current[resultId];
      if (!existing) return current;
      return {
        ...current,
        [resultId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  return (
    <>
      <RegisterPageToolbar>
        <div className="flex min-w-0 items-center gap-3">
          <BackButton
            fallbackHref={`/orgs/${orgId}/tools`}
            className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Tools
          </BackButton>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Scan to Task</p>
            <p className="truncate text-xs text-muted-foreground">Turn PDFs, images, and docs into task items.</p>
          </div>
        </div>

        <SegmentedControl<ViewMode>
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: "Feed" },
            { value: "list", label: "List" },
          ]}
          className="ml-auto"
        />
      </RegisterPageToolbar>

      <div className="flex flex-col gap-5 py-5">
        <ScanToTaskUploadSection
          formRef={formRef}
          fileInputRef={fileInputRef}
          selectedFiles={selectedFiles}
          scanPending={scanPending}
          onSubmit={handleSubmit}
          onFilesChange={(files) => setSelectedFiles(files)}
        />

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <ScanToTaskResultsSection
            results={scannedResults}
            view={view}
            emptySelectedLabel={emptySelectedLabel}
            selectedResultId={selectedResultId}
            confirmedTasksById={confirmedTasksById}
            onSelectResult={setSelectedResultId}
          />

          <ScanToTaskInspector
            selectedResult={selectedResult}
            selectedDraft={selectedDraft}
            selectedTask={selectedTask ?? null}
            confirmPending={confirmPending}
            onConfirmSubmit={handleConfirmSubmit}
            onDraftChange={handleDraftChange}
          />
        </div>
      </div>
    </>
  );
}
