"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DraftScanResultItem } from "./scan-to-task-results-section";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { formatFileSize } from "@/lib/services/scan-to-task-shared";

type ScanToTaskInspectorProps = {
  selectedResult: DraftScanResultItem | null;
  selectedDraft: ScanTaskDraft | null;
  selectedTask: { taskId: string; taskHref: string } | null;
  confirmPending: boolean;
  onConfirmSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: (resultId: string, patch: Partial<ScanTaskDraft>) => void;
  onReject: (() => void) | null;
};

export function ScanToTaskInspector({
  selectedResult,
  selectedDraft,
  selectedTask,
  confirmPending,
  onConfirmSubmit,
  onDraftChange,
  onReject,
}: ScanToTaskInspectorProps) {
  return (
    <aside className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Inspector</h2>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-foreground wrap-break-word">
            {selectedResult && selectedResult.ok ? selectedDraft?.title ?? selectedResult.fileName : "Select a task"}
          </p>
        </div>
        {selectedTask ? (
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href={selectedTask.taskHref}>Open task</Link>
          </Button>
        ) : null}
      </div>

      {selectedResult ? (
        selectedResult.ok ? (
          <form className="mt-4 flex flex-col gap-4" onSubmit={onConfirmSubmit}>
            <input type="hidden" name="resultId" value={selectedResult.clientId} />
            <input type="hidden" name="fileName" value={selectedResult.fileName} />

            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source</p>
              <p className="mt-2 text-sm text-foreground wrap-break-word">{selectedResult.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {selectedResult.fileKind} · {formatFileSize(selectedResult.fileSize)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Title</span>
                <Input
                  name="title"
                  value={selectedDraft?.title ?? ""}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { title: event.target.value })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>

              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Summary</span>
                <Input
                  name="summary"
                  value={selectedDraft?.summary ?? ""}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { summary: event.target.value })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>

              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Description</span>
                <textarea
                  name="description"
                  rows={5}
                  value={selectedDraft?.description ?? ""}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { description: event.target.value })}
                  disabled={confirmPending || Boolean(selectedTask)}
                  className="min-h-28 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Duration</span>
                <Input
                  type="number"
                  name="durationMin"
                  min={1}
                  value={selectedDraft?.durationMin ?? 0}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { durationMin: Number(event.target.value) || 0 })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">People</span>
                <Input
                  type="number"
                  name="peopleRequired"
                  min={1}
                  value={selectedDraft?.peopleRequired ?? 0}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { peopleRequired: Number(event.target.value) || 0 })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wait min</span>
                <Input
                  type="number"
                  name="minWaitDays"
                  min={0}
                  value={selectedDraft?.minWaitDays ?? 0}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { minWaitDays: Number(event.target.value) || 0 })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wait max</span>
                <Input
                  type="number"
                  name="maxWaitDays"
                  min={0}
                  value={selectedDraft?.maxWaitDays ?? 0}
                  onChange={(event) => onDraftChange(selectedResult.clientId, { maxWaitDays: Number(event.target.value) || 0 })}
                  disabled={confirmPending || Boolean(selectedTask)}
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedTask
                  ? "This task has been confirmed and removed from the review queue."
                  : "Review the drafted details, make changes, then confirm to create the task."}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="w-full sm:w-auto" disabled={confirmPending || Boolean(selectedTask)}>
                  {confirmPending ? "Creating…" : selectedTask ? "Task created" : "Confirm task"}
                </Button>
                {onReject ? (
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onReject} disabled={confirmPending}>
                    Reject & remove
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <p>{selectedResult.error}</p>
            {onReject ? (
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="destructive" size="sm" onClick={onReject}>
                  Remove from queue
                </Button>
              </div>
            ) : null}
          </div>
        )
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Nothing selected</p>
          <p className="max-w-xs text-xs text-muted-foreground">Upload files and select a scanned result to review it here.</p>
        </div>
      )}
    </aside>
  );
}