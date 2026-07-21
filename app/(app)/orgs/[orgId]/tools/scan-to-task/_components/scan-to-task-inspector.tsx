"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DraftScanResultItem } from "./scan-to-task-results-section";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";

type ScanToTaskInspectorProps = {
  selectedResult: DraftScanResultItem | null;
  selectedDraft: ScanTaskDraft | null;
  selectedTask: { taskId: string; taskHref: string } | null;
  confirmPending: boolean;
  onConfirmSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDraftChange: (resultId: string, patch: Partial<ScanTaskDraft>) => void;
};

export function ScanToTaskInspector({
  selectedResult,
  selectedDraft,
  selectedTask,
  confirmPending,
  onConfirmSubmit,
  onDraftChange,
}: ScanToTaskInspectorProps) {
  return (
    <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inspector</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {selectedResult && selectedResult.ok ? selectedDraft?.title ?? selectedResult.fileName : "Select a task"}
          </h2>
        </div>
        {selectedTask ? (
          <Button asChild size="sm" variant="outline">
            <Link href={selectedTask.taskHref}>Open task</Link>
          </Button>
        ) : null}
      </div>

      {selectedResult ? (
        selectedResult.ok ? (
          <form className="mt-4 flex flex-col gap-4" onSubmit={onConfirmSubmit}>
            <input type="hidden" name="resultId" value={selectedResult.clientId} />
            <input type="hidden" name="fileName" value={selectedResult.fileName} />

            <div className="rounded-2xl border bg-background/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source</p>
              <p className="mt-2 text-sm text-foreground">{selectedResult.fileName}</p>
              <p className="text-xs text-muted-foreground">{selectedResult.fileKind}</p>
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
                  className="min-h-28 rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedTask
                  ? "This task has been confirmed. Open it to keep editing."
                  : "Review the drafted details, make changes, then confirm to create the task."}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={confirmPending || Boolean(selectedTask)}>
                  {confirmPending ? "Creating…" : selectedTask ? "Task created" : "Confirm task"}
                </Button>
                {selectedTask ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={selectedTask.taskHref}>Open task</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {selectedResult.error}
          </div>
        )
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/50 p-6 text-sm text-muted-foreground">
          Upload files and click a task result to inspect it here.
        </div>
      )}
    </aside>
  );
}