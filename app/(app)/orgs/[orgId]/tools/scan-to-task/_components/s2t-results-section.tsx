"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Eye, FileScan, Loader2, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { formatFileSize } from "@/lib/services/scan-to-task-shared";
import type { ScanToTaskResultItem } from "@/app/actions/tools/s2t";
import { MergeSourceTree } from "./s2t-merge-source-tree";

export type DraftScanResultItem = ScanToTaskResultItem & { clientId: string; createdAt?: string; updatedAt?: string };

type ScanToTaskResultsSectionProps = {
  results: DraftScanResultItem[];
  loading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  emptySelectedLabel: string;
  selectedResultId: string | null;
  confirmedTasksById: Record<string, { taskId: string; taskHref: string }>;
  onSelectResult: (resultId: string) => void;
  onAcceptResult: (resultId: string) => void;
  onRemoveResult: (resultId: string) => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

function isReadyResult(result: DraftScanResultItem): result is Extract<DraftScanResultItem, { ok: true }> {
  return result.ok;
}

function resultKey(result: DraftScanResultItem) {
  return result.clientId;
}

function formatItemDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function getMergedSourceSummary(result: DraftScanResultItem) {
  if (!result.ok) return null;

  const mergedFromResultIds = result.metadata?.mergedFromResultIds ?? [];
  const mergedFromTaskIds = result.metadata?.mergedFromTaskIds ?? [];
  if (mergedFromResultIds.length === 0 && mergedFromTaskIds.length === 0) return null;

  const draftCount = mergedFromResultIds.length;
  const taskCount = mergedFromTaskIds.length;

  return {
    label: `Merged from ${draftCount} draft${draftCount === 1 ? "" : "s"}${taskCount > 0 ? ` and ${taskCount} task${taskCount === 1 ? "" : "s"}` : ""}`,
    title: [
      draftCount > 0 ? `Draft IDs: ${mergedFromResultIds.join(", ")}` : null,
      taskCount > 0 ? `Task IDs: ${mergedFromTaskIds.join(", ")}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | "),
  };
}

function getReferencedResultIds(results: DraftScanResultItem[]) {
  const referencedIds = new Set<string>();

  for (const result of results) {
    if (!result.ok) continue;

    for (const mergedResultId of result.metadata?.mergedFromResultIds ?? []) {
      referencedIds.add(mergedResultId);
    }
  }

  return referencedIds;
}

export function ScanToTaskResultsSection({
  results,
  loading,
  hasMore,
  isLoadingMore,
  sentinelRef,
  emptySelectedLabel,
  selectedResultId,
  confirmedTasksById,
  onSelectResult,
  onAcceptResult,
  onRemoveResult,
  onInspectTaskCandidate,
  onDeleteTask,
}: ScanToTaskResultsSectionProps) {
  const readyResultsById = useMemo(
    () => new Map(results.filter(isReadyResult).map((result) => [result.clientId, result] as const)),
    [results],
  );
  const referencedResultIds = useMemo(() => getReferencedResultIds(results), [results]);
  const visibleResults = useMemo(
    () => results.filter((result) => !referencedResultIds.has(result.clientId)),
    [referencedResultIds, results],
  );
  const readyResults = visibleResults.filter(isReadyResult);
  const confirmedResults = visibleResults.filter((result) => result.ok && confirmedTasksById[result.clientId]);
  const totalConfirmed = confirmedResults.length;
  const totalReady = readyResults.length - totalConfirmed;
  const totalFailed = visibleResults.length - readyResults.length;

  return (
    <section className="flex max-h-[80dvh] min-h-96 min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex min-h-0 flex-col p-4 sm:p-6">
        <ResultsHeader
          totalReady={totalReady}
          totalConfirmed={totalConfirmed}
          totalFailed={totalFailed}
          emptySelectedLabel={emptySelectedLabel}
        />

        <div className="mt-4 min-h-0 overflow-y-auto overscroll-y-contain pr-1 [touch-action:pan-y]">
          <div className="space-y-4">
            {loading ? <LoadingNotice /> : null}

            {visibleResults.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col gap-2">
                {visibleResults.map((result) => (
                  <ScanResultListRow
                    key={result.clientId}
                    result={result}
                    readyResultsById={readyResultsById}
                    selected={selectedResultId === resultKey(result)}
                    confirmedTaskHref={result.ok ? confirmedTasksById[result.clientId]?.taskHref ?? null : null}
                    onSelect={() => onSelectResult(resultKey(result))}
                    onAccept={() => onAcceptResult(resultKey(result))}
                    onSelectResult={onSelectResult}
                    onAcceptResult={onAcceptResult}
                    onRemove={onRemoveResult}
                    onInspectTaskCandidate={onInspectTaskCandidate}
                    onDeleteTask={onDeleteTask}
                  />
                ))}
              </div>
            )}

            {hasMore ? <LoadMoreHistory sentinelRef={sentinelRef} isLoadingMore={isLoadingMore} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScanResultListRow({
  result,
  readyResultsById,
  selected,
  confirmedTaskHref,
  onSelect,
  onAccept,
  onSelectResult,
  onAcceptResult,
  onRemove,
  onInspectTaskCandidate,
  onDeleteTask,
}: {
  result: DraftScanResultItem;
  readyResultsById: Map<string, Extract<DraftScanResultItem, { ok: true }>>;
  selected: boolean;
  confirmedTaskHref?: string | null;
  onSelect: () => void;
  onAccept: () => void;
  onSelectResult: (resultId: string) => void;
  onAcceptResult: (resultId: string) => void;
  onRemove: (resultId: string) => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const mergedSourceSummary = getMergedSourceSummary(result);
  const mergeSourceResult = result.ok ? result : null;
  const isCreatedOrConfirmed = Boolean(confirmedTaskHref) || Boolean(result.ok && result.taskId);
  const hasMergeSources = Boolean(mergedSourceSummary);
  const [mergeTreeOpen, setMergeTreeOpen] = useState(Boolean(mergedSourceSummary));
  const mergeTreeId = useId();
  const mergeTreePanelId = hasMergeSources ? `${mergeTreeId}-merge-sources` : undefined;

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border border-border/60 bg-background p-3 text-left transition-[border-color,background-color,box-shadow] hover:border-primary/30",
        selected && "border-primary/40 bg-primary/5 shadow-sm",
      )}
    >
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <button
          type="button"
          onClick={() => {
            if (mergeSourceResult && hasMergeSources) {
              setMergeTreeOpen((current) => !current);
              return;
            }
            onSelect();
          }}
          aria-pressed={selected}
          aria-expanded={hasMergeSources ? mergeTreeOpen : undefined}
          aria-controls={mergeTreePanelId}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
            hasMergeSources && "cursor-pointer",
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
              result.ok
                ? "bg-muted text-muted-foreground ring-border/70"
                : "bg-destructive/10 text-destructive ring-destructive/15",
            )}
          >
            <FileScan className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {result.ok ? result.draft.title : result.error}
              </span>
              <Badge variant={result.ok ? (isCreatedOrConfirmed ? "success" : "neutral") : "error"} size="sm">
                {result.ok ? (isCreatedOrConfirmed ? "Confirmed" : "Ready") : "Failed"}
              </Badge>
              {mergedSourceSummary ? (
                <Badge variant="warning" size="sm">
                  Merged
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {result.fileName} · {formatFileSize(result.fileSize)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {formatItemDate(result.createdAt) ?? "-"}
            </p>
            {mergedSourceSummary ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400" title={mergedSourceSummary.title}>
                {mergedSourceSummary.label}
              </p>
            ) : null}
            {hasMergeSources ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
                <ChevronDown className={cn("h-3 w-3 transition-transform", mergeTreeOpen && "rotate-180")} />
                {mergeTreeOpen ? "Hide sources" : "Show sources"}
              </span>
            ) : null}
          </div>
        </button>

        <div className="flex w-full shrink-0 flex-col items-stretch gap-1.5 sm:w-24">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 px-2.5 text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              if (result.ok && result.taskId) {
                onInspectTaskCandidate(result.clientId, result.taskId);
                return;
              }
              onSelect();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            Inspect
          </Button>
          {result.ok && !isCreatedOrConfirmed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-1.5 px-2.5"
              onClick={(event) => {
                event.stopPropagation();
                onAccept();
              }}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 px-2.5 text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              if (result.ok && result.taskId && !window.confirm(`Delete task "${result.draft.title}"?`)) return;
              onRemove(result.clientId);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {result.ok && isCreatedOrConfirmed ? "Delete" : "Remove"}
          </Button>
          {result.ok && confirmedTaskHref ? (
            <Link
              href={confirmedTaskHref}
              className="flex h-8 w-full items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {mergeSourceResult && mergeTreeOpen ? (
        <div id={mergeTreePanelId} className="w-full">
          <MergeSourceTree
            result={mergeSourceResult}
            sourceResultId={mergeSourceResult.clientId}
            readyResultsById={readyResultsById}
            onSelectResult={onSelectResult}
            onAcceptResult={onAcceptResult}
            onRemoveResult={onRemove}
            onInspectTaskCandidate={onInspectTaskCandidate}
            onDeleteTask={onDeleteTask}
          />
        </div>
      ) : null}
    </div>
  );
}

function LoadingNotice() {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">AI is analyzing the files</p>
        <p className="text-xs text-muted-foreground">This usually takes a few seconds while the drafts are generated.</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
      <FileScan className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">No scans yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">Upload documents, pictures, or PDFs to create tasks from them.</p>
    </div>
  );
}

type LoadMoreHistoryProps = {
  sentinelRef: RefObject<HTMLDivElement | null>;
  isLoadingMore: boolean;
};

function LoadMoreHistory({ sentinelRef, isLoadingMore }: LoadMoreHistoryProps) {
  return (
    <div
      ref={sentinelRef}
      className="mt-4 flex items-center justify-center rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
    >
      {isLoadingMore ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          Loading more history...
        </>
      ) : (
        "Scroll to load more"
      )}
    </div>
  );
}

type ResultsHeaderProps = {
  totalReady: number;
  totalConfirmed: number;
  totalFailed: number;
  emptySelectedLabel: string;
};

function ResultsHeader({ totalReady, totalConfirmed, totalFailed, emptySelectedLabel }: ResultsHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <FileScan className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Scan queue</h2>
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
          {totalReady > 0 || totalConfirmed > 0 || totalFailed > 0
            ? `${totalReady} ready${totalConfirmed > 0 ? `, ${totalConfirmed} confirmed` : ""}${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`
            : emptySelectedLabel}
        </p>
      </div>
    </div>
  );
}