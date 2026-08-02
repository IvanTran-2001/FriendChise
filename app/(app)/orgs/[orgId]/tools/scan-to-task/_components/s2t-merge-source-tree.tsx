"use client";

import { Check, ChevronRight, Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import type { DraftScanResultItem } from "./s2t-results-section";

type MergeSourceNode =
  | {
      kind: "result";
      id: string;
      result: Extract<DraftScanResultItem, { ok: true }>;
      children: MergeSourceNode[];
    }
  | {
      kind: "task";
      id: string;
      taskId: string;
    }
  | {
      kind: "missing-result";
      id: string;
      resultId: string;
    }
  | {
      kind: "cycle";
      id: string;
      result: Extract<DraftScanResultItem, { ok: true }>;
    };

type MergeSourceTreeProps = {
  result: Extract<DraftScanResultItem, { ok: true }>;
  sourceResultId: string;
  readyResultsById: Map<string, Extract<DraftScanResultItem, { ok: true }>>;
  onSelectResult: (resultId: string) => void;
  onAcceptResult: (resultId: string) => void;
  onRemoveResult: (resultId: string) => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

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

function getMergeSourceNodes(
  result: Extract<DraftScanResultItem, { ok: true }>,
  resultsById: Map<string, Extract<DraftScanResultItem, { ok: true }>>,
  path = new Set<string>(),
): MergeSourceNode[] {
  const mergedFromResultIds = result.metadata?.mergedFromResultIds ?? [];
  const mergedFromTaskIds = result.metadata?.mergedFromTaskIds ?? [];
  const nodes: MergeSourceNode[] = [];

  for (const sourceResultId of mergedFromResultIds) {
    const sourceResult = resultsById.get(sourceResultId);
    if (!sourceResult) {
      nodes.push({ kind: "missing-result", id: `missing:${sourceResultId}`, resultId: sourceResultId });
      continue;
    }

    if (path.has(sourceResultId)) {
      nodes.push({ kind: "cycle", id: `cycle:${sourceResultId}`, result: sourceResult });
      continue;
    }

    const nextPath = new Set(path);
    nextPath.add(result.clientId);
    nextPath.add(sourceResultId);
    nodes.push({
      kind: "result",
      id: `result:${sourceResultId}`,
      result: sourceResult,
      children: getMergeSourceNodes(sourceResult, resultsById, nextPath),
    });
  }

  for (const taskId of mergedFromTaskIds) {
    nodes.push({ kind: "task", id: `task:${taskId}`, taskId });
  }

  return nodes;
}

export function MergeSourceTree({
  result,
  sourceResultId,
  readyResultsById,
  onSelectResult,
  onAcceptResult,
  onRemoveResult,
  onInspectTaskCandidate,
  onDeleteTask,
}: MergeSourceTreeProps) {
  const mergedSourceSummary = getMergedSourceSummary(result);
  const mergeSourceNodes = getMergeSourceNodes(result, readyResultsById);

  if (!mergedSourceSummary && mergeSourceNodes.length === 0) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-amber-500/15 bg-linear-to-b from-amber-500/8 via-background/95 to-background p-2 shadow-sm sm:p-3">
      <div className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-200/80">
            Source trail
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Tap a source row to expand nested merges or inspect the draft.</p>
        </div>
        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
          {mergeSourceNodes.length} item{mergeSourceNodes.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        {mergeSourceNodes.map((node) => (
          <MergeSourceTreeNode
            key={node.id}
            node={node}
            sourceResultId={sourceResultId}
            onSelectResult={onSelectResult}
            onAcceptResult={onAcceptResult}
            onRemoveResult={onRemoveResult}
            onInspectTaskCandidate={onInspectTaskCandidate}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      {mergedSourceSummary ? (
        <p className="mt-2 px-1 text-xs text-amber-600 dark:text-amber-400" title={mergedSourceSummary.title}>
          {mergedSourceSummary.label}
        </p>
      ) : null}
    </div>
  );
}

function MergeSourceTreeNode({
  node,
  sourceResultId,
  onSelectResult,
  onAcceptResult,
  onRemoveResult,
  onInspectTaskCandidate,
  onDeleteTask,
}: {
  node: MergeSourceNode;
  sourceResultId: string;
  onSelectResult: (resultId: string) => void;
  onAcceptResult: (resultId: string) => void;
  onRemoveResult: (resultId: string) => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.kind === "task") {
    return (
      <SourceTreeRow
        label="Task"
        title={node.taskId}
        variant="task"
        onInspect={() => onInspectTaskCandidate(sourceResultId, node.taskId)}
        onDelete={() => onDeleteTask(node.taskId)}
        deleteLabel={`Delete task source ${node.taskId}`}
      />
    );
  }

  if (node.kind === "missing-result") {
    return <SourceTreeRow label="Draft" title={node.resultId} variant="missing" onInspect={() => onSelectResult(node.resultId)} />;
  }

  if (node.kind === "cycle") {
    return <SourceTreeRow label="Cycle" title={node.result.fileName} variant="warning" onInspect={() => onSelectResult(node.result.clientId)} />;
  }

  const sourceSummary = getMergedSourceSummary(node.result);
  const hasChildren = node.children.length > 0;
  const isTaskSource = Boolean(node.result.taskId);
  const handlePrimaryPress = () => {
    if (hasChildren) {
      setExpanded((current) => !current);
      return;
    }

    if (isTaskSource && node.result.taskId) {
      onInspectTaskCandidate(sourceResultId, node.result.taskId);
      return;
    }

    onSelectResult(node.result.clientId);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/15 bg-background/90 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-amber-500/5"
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={hasChildren ? `${expanded ? "Collapse" : "Expand"} ${node.result.fileName}` : `Inspect ${node.result.fileName}`}
          onClick={(event) => {
            event.stopPropagation();
            handlePrimaryPress();
          }}
        >
          <span
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-amber-700 dark:text-amber-200",
              hasChildren ? "border-amber-500/20 bg-amber-500/10" : "border-border/70 bg-muted/40 text-muted-foreground",
            )}
            aria-hidden="true"
          >
            {hasChildren ? <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} /> : <Eye className="h-3.5 w-3.5" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-xs font-medium text-foreground">{node.result.draft.title}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {formatItemDate(node.result.createdAt) ?? "-"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{node.result.fileName}</p>
            {sourceSummary ? <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">{sourceSummary.label}</p> : null}
            {hasChildren ? (
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {expanded ? "Tap to hide nested sources" : "Tap to view nested sources"}
              </p>
            ) : null}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1 border-t border-amber-500/10 px-3 py-2 sm:border-l sm:border-t-0 sm:px-2 sm:py-3">
          {!isTaskSource ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground sm:h-7 sm:w-7"
              aria-label={`Accept ${node.result.fileName}`}
              onClick={(event) => {
                event.stopPropagation();
                onAcceptResult(node.result.clientId);
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 text-muted-foreground hover:bg-rose-500/10 hover:text-foreground sm:h-7 sm:w-7"
            aria-label={`Remove source draft ${node.result.fileName}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveResult(node.result.clientId);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="space-y-2 border-t border-amber-500/10 px-2 py-2 sm:px-3 sm:pl-5">
          {node.children.map((child) => (
            <MergeSourceTreeNode
              key={child.id}
              node={child}
              sourceResultId={node.result.clientId}
              onSelectResult={onSelectResult}
              onAcceptResult={onAcceptResult}
              onRemoveResult={onRemoveResult}
              onInspectTaskCandidate={onInspectTaskCandidate}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SourceTreeRow({
  label,
  title,
  variant,
  onInspect,
  onDelete,
  deleteLabel,
}: {
  label: string;
  title: string;
  variant: "task" | "warning" | "missing";
  onInspect: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border text-xs shadow-sm",
        variant === "task"
          ? "border-amber-500/10 bg-amber-500/5 text-amber-700 dark:text-amber-200"
          : variant === "warning"
            ? "border-amber-500/15 bg-amber-500/5 text-amber-700 dark:text-amber-200"
            : "border-dashed border-border/70 bg-muted/20 text-muted-foreground",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-background/60"
          aria-label={`Inspect ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onInspect();
          }}
        >
          <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            {label}
          </span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </button>
        {onDelete ? (
          <div className="flex shrink-0 items-center justify-end border-t border-border/40 px-3 py-2 sm:border-l sm:border-t-0 sm:px-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 text-muted-foreground hover:bg-rose-500/10 hover:text-foreground sm:h-7 sm:w-7"
              aria-label={deleteLabel ?? `Remove source ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}