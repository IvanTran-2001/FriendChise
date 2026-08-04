"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  confirmScanToTaskAction,
  clearScanToTaskResultAction,
  deleteScanToTaskUploadsAction,
  updateScanToTaskDraftAction,
  deleteScanToTaskConflictItemsAction,
  pruneScanToTaskMergeSourceReferencesAction,
  mergeScanToTaskConflictItemsAction,
  getScanToTaskUploadUrlAction,
  scanToTaskAction,
} from "@/app/actions/tools/s2t";
import { deleteTaskAction, getTaskDetailsAction, updateTaskAction } from "@/app/actions/tasks";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { colorFromSeed } from "@/lib/services/scan-to-task";
import { getScanToTaskUploadContentType, resolveScanUploadMimeType } from "@/lib/services/scan-to-task-shared";
import { ScanToTaskUploadSection } from "./_components/s2t-upload-section";
import { ScanToTaskResultsSection, type DraftScanResultItem } from "./_components/s2t-results-section";
import { ScanToTaskConflictList } from "./_components/s2t-conflict-list";
import { ScanToTaskInspectorPanel, type InspectorFormValues } from "./_components/s2t-inspector-panel";
import { useScanTaskHistoryPagination } from "./_components/s2t-history-pagination";
import { buildConflictGroups, type ConflictGroup } from "./_components/s2t-helpers";
import type { TaskDuplicateCandidate } from "@/lib/services/tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/dialogs/alert-dialog";

type ScanSourceRef = { storagePath: string; fileName: string; mimeType: string; fileSize: number };
type TaskDetails = {
  id: string;
  orgId: string;
  color: string;
  name: string;
  description: string | null;
  durationMin: number;
  preferredStartTimeMin: number | null;
  minPeople: number;
  minWaitDays: number | null;
  maxWaitDays: number | null;
};

type SelectedInspectorValues = {
  color: string;
  title: string;
  description: string;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number | null;
  maxWaitDays: number | null;
  sourceFileName: string;
  sourceFileKind: string;
  sourceFileSize: number;
  taskDetailsLabel: string | null;
};

type SelectedInspectorMode = "draft" | "conflict" | "task";
type MergeSourceMetadata = {
  mergedFromResultIds?: string[];
  mergedFromTaskIds?: string[];
};

/**
 * Coordinates the full scan-to-task workflow for an organization.
 * It keeps the upload form, result queue, selected draft, duplicate state,
 * and confirmation actions in sync with the server-backed scan history.
 */
export function ScanToTaskClient({ orgId }: { orgId: string }) {
  // Refs for the form shell and file picker so the client can reset them after scans.
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Server-backed queue state and pagination state for the scan history.
  const {
    results,
    duplicateCandidatesById: historyDuplicateCandidatesById,
    setResults,
    refreshHistory,
    isLoadingInitial,
    isLoadingMore,
    historyError,
    hasMore,
    sentinelRef,
  } = useScanTaskHistoryPagination(orgId);

  // Local UI state for the selected result, upload form, and inspector lifecycle.
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [instructionText, setInstructionText] = useState("");
  const [draftsById, setDraftsById] = useState<Record<string, ScanTaskDraft>>(
    {},
  );
  const [duplicateCandidatesById, setDuplicateCandidatesById] = useState<Record<string, TaskDuplicateCandidate[]>>({});
  const [scanPending, setScanPending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskDetails | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<"queue" | "conflict" | null>(null);
  const selectedResultIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedResultIdRef.current = selectedResultId;
  }, [selectedResultId]);

  /**
   * Keep newly loaded history duplicate candidates in local state without
   * overwriting anything the user or other handlers have already staged.
   */
  useEffect(() => {
    setDuplicateCandidatesById((current) => {
      let changed = false;
      const next = { ...current };

      for (const [resultId, candidates] of Object.entries(historyDuplicateCandidatesById)) {
        if (!next[resultId] && candidates.length > 0) {
          next[resultId] = candidates;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [historyDuplicateCandidatesById]);

  useEffect(() => {
    if (historyError) {
      toast.error(historyError);
    }
  }, [historyError]);

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTaskDetails(null);
      return;
    }

    let cancelled = false;
    setSelectedTaskDetails(null);

    loadSelectedTaskDetails(orgId, selectedTaskId, {
      onSuccess: (task) => {
        if (!cancelled) {
          setSelectedTaskDetails(task);
        }
      },
      onError: (message) => {
        if (!cancelled) {
          setSelectedTaskDetails(null);
          toast.error(message);
        }
      },
    });

    return () => {
      cancelled = true;
    };
  }, [orgId, selectedTaskId]);

  const { selectedResult, selectedDraft, selectedInspectorValues, selectedMode } = buildSelectedScanSelection({
    selectedResultId,
    selectedTaskId,
    selectedSource,
    results,
    draftsById,
    selectedTaskDetails,
  });
  const conflictGroups = useMemo<ConflictGroup[]>(() => {
    return buildConflictGroups(results, duplicateCandidatesById, new Set<string>());
  }, [duplicateCandidatesById, results]);

  const emptySelectedLabel = scanPending
    ? "Scanning files…"
    : selectedFiles.length > 0
      ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} queued for review`
      : "Upload files to start";

  /**
   * Remove a result and any associated local draft or duplicate suggestions
   * from the visible queue.
   */
  const removeResultFromQueue = (resultId: string) => {
    setResults((currentResults) => currentResults.filter((result) => result.clientId !== resultId));

    setSelectedResultId((currentSelectedId) => {
      if (currentSelectedId !== resultId) return currentSelectedId;

      const nextSelectedResultId = (results.find((result) => result.clientId !== resultId && result.ok) ?? results.find((result) => result.clientId !== resultId) ?? null)?.clientId ?? null;
      return nextSelectedResultId;
    });

    setDraftsById((current) => {
      if (!(resultId in current)) return current;
      const next = { ...current };
      delete next[resultId];
      return next;
    });

    setDuplicateCandidatesById((current) => {
      if (!(resultId in current)) return current;
      const next = { ...current };
      delete next[resultId];
      return next;
    });
  };

  const pruneDeletedTaskFromQueue = (taskId: string) => {
    setResults((current) =>
      current.map((result) => {
        if (!result.ok || !result.metadata) return result;

        const metadata = result.metadata as MergeSourceMetadata;
        const nextMergedFromTaskIds = (metadata.mergedFromTaskIds ?? []).filter((mergedTaskId) => mergedTaskId !== taskId);
        if (nextMergedFromTaskIds.length === (metadata.mergedFromTaskIds ?? []).length) return result;

        return {
          ...result,
          metadata:
            nextMergedFromTaskIds.length > 0 || (metadata.mergedFromResultIds ?? []).length > 0
              ? {
                  ...(metadata.mergedFromResultIds?.length ? { mergedFromResultIds: metadata.mergedFromResultIds } : {}),
                  ...(nextMergedFromTaskIds.length ? { mergedFromTaskIds: nextMergedFromTaskIds } : {}),
                }
              : null,
        };
      }),
    );

    setDuplicateCandidatesById((current) => {
      let changed = false;
      const next: Record<string, TaskDuplicateCandidate[]> = {};

      for (const [resultId, candidates] of Object.entries(current)) {
        const nextCandidates = candidates.filter((candidate) => (candidate.taskId ?? candidate.id) !== taskId);
        if (nextCandidates.length !== candidates.length) changed = true;
        if (nextCandidates.length > 0) {
          next[resultId] = nextCandidates;
        } else if (candidates.length > 0) {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  };

  /**
   * Handle the scan form submit by uploading files, invoking the scan action,
   * and then merging the returned result rows into local state.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      toast.error("Upload at least one file.");
      return;
    }

    // Extra instructions by user
    const instruction = new FormData(event.currentTarget).get("instruction")?.toString().trim() ?? "";
    setScanPending(true);

    const uploadedSources: ScanSourceRef[] = [];

    try {
      await uploadSelectedFiles(orgId, selectedFiles, uploadedSources);

      const formData = new FormData();
      if (instruction) formData.set("instruction", instruction);
      for (const source of uploadedSources) {
        formData.append("sources", JSON.stringify(source));
      }

      const nextState = await scanToTaskAction(orgId, null, formData);
      if (!nextState.ok) {
        await cleanupScanToTaskUploads(orgId, uploadedSources.map((source) => source.storagePath));
        toast.error(nextState.error);
        return;
      }

      const nextResults: DraftScanResultItem[] = nextState.results.map((result) => ({
        ...result,
        clientId: result.resultId,
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

      const firstNewResult = nextResults.find((result) => result.ok) ?? nextResults[0] ?? null;

      if (firstNewResult) {
        setSelectedResultId(firstNewResult.clientId);
      }

      setResults((current) => [
        ...nextResults,
        ...current.filter((result) => !nextResults.some((nextResult) => nextResult.clientId === result.clientId)),
      ]);
      setDraftsById((current) => ({ ...current, ...nextDrafts }));
      await refreshHistory();
      formRef.current?.reset();
      setInstructionText("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      await cleanupScanToTaskUploads(orgId, uploadedSources.map((source) => source.storagePath));
      toast.error(error instanceof Error ? error.message : "Failed to scan files.");
    } finally {
      setScanPending(false);
    }
  };

  // Merge selected drafts/tasks into a single new draft row.
  const handleMergeConflictItems = async (group: ConflictGroup, selectedIds: string[], instructions = "") => {
    const selectedDraftResults = group.results.filter((result) => selectedIds.includes(`draft:${result.clientId}`));
    const selectedTaskCandidates = group.duplicateCandidates.filter((candidate) =>
      selectedIds.includes(`task:${candidate.taskId ?? candidate.id}`),
    );

    if (selectedDraftResults.length === 0) {
      toast.error("Select at least one draft to merge.");
      return;
    }

    setConfirmPending(true);
    try {
      const formData = new FormData();
      for (const result of selectedDraftResults) {
        formData.append("resultIds", result.clientId);
      }
      for (const candidate of selectedTaskCandidates) {
        formData.append("taskIds", candidate.taskId ?? candidate.id);
      }
      if (instructions.trim()) {
        formData.set("instruction", instructions.trim());
      }

      const nextState = await mergeScanToTaskConflictItemsAction(orgId, null, formData);
      if (!nextState.ok) {
        toast.error(nextState.error);
        return;
      }

      const mergedResult = nextState.result;
      const mergedClientId = mergedResult.resultId;

      setResults((current) => [
        { ...mergedResult, clientId: mergedClientId },
        ...current.filter((result) => !selectedDraftResults.some((selected) => selected.clientId === result.clientId)),
      ]);
      setDraftsById((current) => ({
        ...Object.fromEntries(Object.entries(current).filter(([resultId]) => !selectedDraftResults.some((selected) => selected.clientId === resultId))),
        [mergedClientId]: mergedResult.draft,
      }));
      setDuplicateCandidatesById((current) => {
        const next = { ...current };
        for (const selected of selectedDraftResults) {
          delete next[selected.clientId];
        }
        return next;
      });
      setSelectedResultId(mergedClientId);
      toast.success("Merged into a new draft.");
      await refreshHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge items.");
    } finally {
      setConfirmPending(false);
    }
  };

  // Delete selected draft rows and/or matching tasks from the conflict panel.
  const handleDeleteConflictItems = async (group: ConflictGroup, selectedIds: string[]) => {
    const selectedDraftResults = group.results.filter((result) => selectedIds.includes(`draft:${result.clientId}`));
    const selectedTaskCandidates = group.duplicateCandidates.filter((candidate) =>
      selectedIds.includes(`task:${candidate.taskId ?? candidate.id}`),
    );

    if (selectedDraftResults.length === 0 && selectedTaskCandidates.length === 0) {
      toast.error("Select at least one draft or task to delete.");
      return;
    }

    setConfirmPending(true);
    try {
      const deleteFormData = new FormData();
      for (const result of selectedDraftResults) {
        deleteFormData.append("resultIds", result.clientId);
      }
      for (const candidate of selectedTaskCandidates) {
        deleteFormData.append("taskIds", candidate.taskId ?? candidate.id);
      }

      const deleteState = await deleteScanToTaskConflictItemsAction(orgId, null, deleteFormData);
      if (!deleteState.ok) {
        toast.error(deleteState.error);
        return;
      }

      setResults((current) => current.filter((result) => !selectedDraftResults.some((selected) => selected.clientId === result.clientId)));
      setDraftsById((current) => {
        const next = { ...current };
        for (const selected of selectedDraftResults) {
          delete next[selected.clientId];
        }
        return next;
      });
      setDuplicateCandidatesById((current) => {
        const next = { ...current };
        for (const selected of selectedDraftResults) {
          delete next[selected.clientId];
        }
        for (const candidate of selectedTaskCandidates) {
          const taskKey = candidate.taskId ?? candidate.id;
          for (const [resultId, candidates] of Object.entries(next)) {
            next[resultId] = candidates.filter((item) => (item.taskId ?? item.id) !== taskKey);
            if (next[resultId].length === 0) {
              delete next[resultId];
            }
          }
        }
        return next;
      });
      for (const candidate of selectedTaskCandidates) {
        const taskKey = candidate.taskId ?? candidate.id;
        pruneDeletedTaskFromQueue(taskKey);
      }
      toast.success("Deleted selected items.");
      await refreshHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected items.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleDeleteTaskById = async (taskId: string) => {
    setConfirmPending(true);
    try {
      const deleteState = await deleteTaskAction(orgId, taskId);
      if (!deleteState.ok) {
        toast.error(deleteState.error);
        return;
      }

      const pruneFormData = new FormData();
      pruneFormData.append("taskIds", taskId);
      const pruneState = await pruneScanToTaskMergeSourceReferencesAction(orgId, null, pruneFormData);
      if (!pruneState.ok) {
        toast.error(pruneState.error);
        return;
      }

      pruneDeletedTaskFromQueue(taskId);

      if (selectedTaskId === taskId) {
        setSelectedTaskDetails(null);
        setSelectedTaskId(null);
        setSelectedSource(null);
      }

      toast.success("Task deleted.");
      await refreshHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task.");
    } finally {
      setConfirmPending(false);
    }
  };

  /**
   * Remove a scan result from the queue or delete the linked task when the
   * scan row has already been confirmed.
   */
  const handleRejectResult = async (resultId: string) => {
    const result = results.find((item) => item.clientId === resultId);
    if (!result || !result.ok) {
      toast.error("Select a drafted result first.");
      return;
    }

    if (result.taskId) {
      setPendingDeleteTaskId(result.taskId);
      return;
    }

    setConfirmPending(true);
    try {
      const clearFormData = new FormData();
      clearFormData.set("resultId", resultId);

      const clearState = await clearScanToTaskResultAction(orgId, null, clearFormData);
      if (!clearState.ok) {
        toast.error(clearState.error);
        return;
      }

      removeResultFromQueue(resultId);
      await refreshHistory();
      toast.success("Draft cleared.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear draft.");
    } finally {
      setConfirmPending(false);
    }
  };

  const handleAcceptResult = async (resultId: string) => {
    const result = results.find((item) => item.clientId === resultId);
    if (!result || !result.ok) {
      toast.error("Select a drafted result first.");
      return;
    }

    const draft = result.draft ?? draftsById[result.clientId];
    if (!draft) {
      toast.error("Missing draft details.");
      return;
    }

    setConfirmPending(true);
    try {
      const values = {
        color: colorFromSeed(`${result.fileName}:${draft.title}`),
        title: draft.title,
        description: draft.description,
        durationMin: draft.durationMin,
        peopleRequired: draft.peopleRequired,
        minWaitDays: draft.minWaitDays,
        maxWaitDays: draft.maxWaitDays,
      } satisfies InspectorFormValues;

      const nextState = await confirmScanToTaskAction(
        orgId,
        null,
        buildConfirmFormData(result.clientId, draft, result.fileName, values),
      );
      if (!nextState.ok) {
        toast.error(nextState.error);
        return;
      }

      removeResultFromQueue(nextState.resultId);
      await refreshHistory();
      toast.success("Task created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm draft.");
    } finally {
      setConfirmPending(false);
    }
  };

  // Open the queue preview for a scanned result.
  const handleSelectResult = (resultId: string, source: "queue" | "conflict" = "queue") => {
    setSelectedTaskId(null);
    setSelectedTaskDetails(null);
    setSelectedSource(source);
    const clickedResult = results.find((result) => result.clientId === resultId);
    if (clickedResult && clickedResult.ok && source === "queue" && clickedResult.taskId) {
      setSelectedTaskId(clickedResult.taskId);
      setSelectedTaskDetails(null);
    } else if (clickedResult && clickedResult.ok) {
      setDraftsById((current) => ({
        ...current,
        [resultId]: clickedResult.draft,
      }));
    }
    setSelectedResultId(resultId);
    setInspectorOpen(true);
  };

  // Open the inspector on a task candidate from a conflict group.
  const handleInspectTaskCandidate = (resultId: string, taskId: string) => {
    setSelectedResultId(resultId);
    setSelectedSource("conflict");
    setSelectedTaskId(taskId);
    setSelectedTaskDetails(null);
    setInspectorOpen(true);
  };

  // Sync the sheet open state back into local inspector state.
  const handleCloseInspector = (open: boolean) => {
    setInspectorOpen(open);
    if (!open) {
      setSelectedResultId(null);
      setSelectedTaskId(null);
      setSelectedTaskDetails(null);
      setSelectedSource(null);
    }
  };

  const handleSaveSelection = async (values: InspectorFormValues) => {
    if (!selectedResult || !selectedResult.ok) {
      toast.error("Select a valid draft before saving.");
      return;
    }

    if (selectedTaskId && !selectedTaskDetails) {
      toast.error("Task details are still loading.");
      return;
    }

    setConfirmPending(true);
    try {
      if (selectedTaskId) {
        const updateState = await updateTaskAction(
          orgId,
          selectedTaskId,
          null,
          buildUpdateTaskFormData(values, selectedTaskDetails?.preferredStartTimeMin),
        );
        if (updateState && !updateState.ok) {
          toast.error(updateState.errors._?.[0] ?? "Failed to save task.");
          return;
        }

        toast.success("Task updated.");
        await refreshHistory();
        return;
      }

      if (!selectedDraft) {
        toast.error("Select a drafted result before saving.");
        return;
      }

      const nextDraft: ScanTaskDraft = {
        ...selectedDraft,
        title: values.title,
        description: values.description,
        durationMin: values.durationMin,
        peopleRequired: values.peopleRequired,
        minWaitDays: values.minWaitDays ?? 0,
        maxWaitDays: values.maxWaitDays ?? 0,
      };

      const nextState = await updateScanToTaskDraftAction(
        orgId,
        null,
        buildConfirmFormData(selectedResult.clientId, nextDraft, selectedResult.fileName, values),
      );
      if (!nextState.ok) {
        toast.error(nextState.error);
        return;
      }

      setDraftsById((current) => ({
        ...current,
        [selectedResult.clientId]: nextState.draft,
      }));
      setResults((current) =>
        current.map((result) =>
          result.clientId === selectedResult.clientId && result.ok
            ? {
                ...result,
                draft: nextState.draft,
              }
            : result,
        ),
      );
      toast.success("Draft saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save selection.");
    } finally {
      setConfirmPending(false);
    }
  };

  // Build the confirmed-task map so result rows can link straight to the task.
  const confirmedTasksById = Object.fromEntries(
    results
      .filter((result): result is Extract<DraftScanResultItem, { ok: true }> => result.ok && Boolean(result.taskId))
      .map((result) => [result.clientId, { taskId: result.taskId as string, taskHref: `/orgs/${orgId}/tasks/${result.taskId}` }]),
  );

  const isSelectedTaskDetailsLoading = Boolean(selectedTaskId && !selectedTaskDetails);

  return (
    // No overflow-x here: `overflow-x-hidden` without an explicit overflow-y forces
    // overflow-y to compute as `auto` (CSS spec), turning this whole stack into its
    // own shrinkable scroll container inside <main> and collapsing the scan queue's
    // own max-height. `main` already clips horizontal overflow, so this is redundant.
    <div className="flex w-full flex-col gap-4 px-3 py-3 sm:px-6 sm:py-6 lg:px-8 xl:px-10">

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

      <ScanToTaskConflictList
        conflictGroups={conflictGroups}
        draftsById={draftsById}
        onSelectResult={handleSelectResult}
        onInspectTaskCandidate={handleInspectTaskCandidate}
        onStageMergeConflictItems={handleMergeConflictItems}
        onStageDeleteConflictItems={handleDeleteConflictItems}
      />

      <ScanToTaskResultsSection
        results={results}
        loading={scanPending || isLoadingInitial}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        sentinelRef={sentinelRef}
        emptySelectedLabel={emptySelectedLabel}
        selectedResultId={selectedResultId}
        confirmedTasksById={confirmedTasksById}
        onSelectResult={handleSelectResult}
        onAcceptResult={handleAcceptResult}
        onRemoveResult={handleRejectResult}
        onInspectTaskCandidate={handleInspectTaskCandidate}
        onDeleteTask={handleDeleteTaskById}
      />

      <ScanToTaskInspectorPanel
        key={`${selectedTaskId ?? selectedResult?.clientId ?? "none"}:${selectedMode}`}
        open={inspectorOpen && Boolean(selectedInspectorValues)}
        mode={selectedMode}
        color={selectedInspectorValues?.color ?? "#6366f1"}
        title={selectedInspectorValues?.title ?? "Select a task"}
        description={selectedInspectorValues?.description ?? ""}
        durationMin={selectedInspectorValues?.durationMin ?? 0}
        peopleRequired={selectedInspectorValues?.peopleRequired ?? 0}
        minWaitDays={selectedInspectorValues?.minWaitDays ?? null}
        maxWaitDays={selectedInspectorValues?.maxWaitDays ?? null}
        sourceFileName={selectedInspectorValues?.sourceFileName ?? ""}
        sourceFileKind={selectedInspectorValues?.sourceFileKind ?? ""}
        sourceFileSize={selectedInspectorValues?.sourceFileSize ?? 0}
        taskDetailsLabel={selectedInspectorValues?.taskDetailsLabel ?? null}
        confirmPending={confirmPending}
        onDelete={selectedResult ? () => void handleRejectResult(selectedResult.clientId) : null}
        onSave={selectedInspectorValues ? handleSaveSelection : null}
        saveDisabled={isSelectedTaskDetailsLoading}
        onOpenChange={handleCloseInspector}
      />

      <AlertDialog
        open={pendingDeleteTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTaskId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete linked task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the linked task and remove it from the scan queue. Draft results without a linked task will still clear without this dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteTaskId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const taskId = pendingDeleteTaskId;
                setPendingDeleteTaskId(null);
                if (taskId) void handleDeleteTaskById(taskId);
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Uploads the selected files to storage and collects the resolved upload
 * metadata so the scan action can reference the stored objects.
 */
async function uploadSelectedFiles(
  orgId: string,
  selectedFiles: File[],
  uploadedSources: ScanSourceRef[],
) {
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

    uploadedSources.push({
      storagePath: uploadState.path,
      fileName: file.name,
      mimeType: resolvedMimeType,
      fileSize: file.size,
    });

    const uploadResponse = await fetch(uploadState.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": uploadContentType },
    });
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload "${file.name}".`);
    }
  }
}

function buildSelectedInspectorValues(
  selectedResult: DraftScanResultItem | null,
  selectedDraft: ScanTaskDraft | null,
  selectedTaskDetails: TaskDetails | null,
): SelectedInspectorValues | null {
  if (!selectedResult || !selectedResult.ok) return null;

  const color = selectedTaskDetails?.color ?? colorFromSeed(`${selectedResult.fileName}:${selectedDraft?.title ?? selectedResult.fileName}`);

  return {
    color,
    title: selectedTaskDetails?.name ?? selectedDraft?.title ?? selectedResult.fileName,
    description: selectedTaskDetails?.description ?? selectedDraft?.description ?? "",
    durationMin: selectedTaskDetails?.durationMin ?? selectedDraft?.durationMin ?? 0,
    peopleRequired: selectedTaskDetails?.minPeople ?? selectedDraft?.peopleRequired ?? 0,
    minWaitDays: selectedTaskDetails?.minWaitDays ?? selectedDraft?.minWaitDays ?? null,
    maxWaitDays: selectedTaskDetails?.maxWaitDays ?? selectedDraft?.maxWaitDays ?? null,
    sourceFileName: selectedResult.fileName,
    sourceFileKind: selectedResult.fileKind,
    sourceFileSize: selectedResult.fileSize,
    taskDetailsLabel: selectedTaskDetails ? `Confirmed task #${selectedTaskDetails.id}` : null,
  };
}

type SelectedScanSelection = {
  selectedResult: DraftScanResultItem | null;
  selectedDraft: ScanTaskDraft | null;
  selectedMode: SelectedInspectorMode;
  selectedInspectorValues: SelectedInspectorValues | null;
};

function buildSelectedScanSelection({
  selectedResultId,
  selectedTaskId,
  selectedSource,
  results,
  draftsById,
  selectedTaskDetails,
}: {
  selectedResultId: string | null;
  selectedTaskId: string | null;
  selectedSource: "queue" | "conflict" | null;
  results: DraftScanResultItem[];
  draftsById: Record<string, ScanTaskDraft>;
  selectedTaskDetails: TaskDetails | null;
}): SelectedScanSelection {
  const selectedResult = selectedResultId ? results.find((result) => result.clientId === selectedResultId) ?? null : null;
  const selectedDraft = selectedResult && selectedResult.ok ? selectedResult.draft ?? draftsById[selectedResult.clientId] ?? null : null;
  const selectedMode: SelectedInspectorMode = selectedTaskId
    ? "task"
    : selectedSource === "conflict"
      ? "conflict"
      : "draft";

  return {
    selectedResult,
    selectedDraft,
    selectedMode,
    selectedInspectorValues: buildSelectedInspectorValues(selectedResult, selectedDraft, selectedTaskDetails),
  };
}

function buildConfirmFormData(
  resultId: string,
  draft: ScanTaskDraft,
  fileName: string,
  values: InspectorFormValues,
  duplicateAction?: string,
  duplicateCandidateId?: string,
) {
  const formData = new FormData();
  formData.set("resultId", resultId);
  formData.set("fileName", fileName);
  formData.set("color", values.color);
  formData.set("title", values.title);
  formData.set("description", values.description);
  formData.set("summary", draft.summary);
  formData.set("sourceText", draft.sourceText);
  formData.set("durationMin", String(values.durationMin));
  formData.set("peopleRequired", String(values.peopleRequired));
  formData.set("minWaitDays", values.minWaitDays == null ? "" : String(values.minWaitDays));
  formData.set("maxWaitDays", values.maxWaitDays == null ? "" : String(values.maxWaitDays));
  if (duplicateAction) {
    formData.set("duplicateAction", duplicateAction);
  }
  if (duplicateCandidateId) {
    formData.set("duplicateCandidateId", duplicateCandidateId);
  }
  return formData;
}

function buildUpdateTaskFormData(values: InspectorFormValues, preferredStartTimeMin: number | null | undefined) {
  const formData = new FormData();
  formData.set("color", values.color);
  formData.set("title", values.title);
  formData.set("description", values.description);
  formData.set("durationMin", String(values.durationMin));
  formData.set("peopleRequired", String(values.peopleRequired));
  formData.set("minWaitDays", values.minWaitDays == null ? "" : String(values.minWaitDays));
  formData.set("maxWaitDays", values.maxWaitDays == null ? "" : String(values.maxWaitDays));
  formData.set("preferredStartTimeMin", preferredStartTimeMin == null ? "" : String(preferredStartTimeMin));
  return formData;
}

/**
 * Best-effort cleanup for uploaded files when scanning or upload fails.
 * Keeps the server mutation in the action layer and the wrapper local to this file.
 */
async function cleanupScanToTaskUploads(orgId: string, storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  try {
    const cleanupFormData = new FormData();
    for (const storagePath of storagePaths) {
      cleanupFormData.append("storagePaths", storagePath);
    }
    await deleteScanToTaskUploadsAction(orgId, null, cleanupFormData);
  } catch {
    // Best effort only; preserve the original upload/scan failure.
  }
}

type SelectedTaskDetailsHandlers = {
  onSuccess: (task: TaskDetails) => void;
  onError: (message: string) => void;
};

async function loadSelectedTaskDetails(orgId: string, taskId: string, handlers: SelectedTaskDetailsHandlers) {
  const result = await getTaskDetailsAction(orgId, taskId);
  if (result.ok) {
    handlers.onSuccess(result.task);
    return;
  }

  handlers.onError(result.error);
}
