"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ListChecks, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import type { DraftScanResultItem } from "./s2t-results-section";
import type { ConflictGroup } from "./s2t-helpers";
import type { TaskDuplicateCandidate } from "@/lib/services/tasks";
import { ConflictActionsPanel } from "./s2t-conflict-actions-panel";

function buildConflictPanelTitle(group: Pick<ConflictGroup, "primaryResult">) {
  return `Conflict actions: ${group.primaryResult.fileName}`;
}

function buildConflictPanelContentKey(group: ConflictGroup) {
  return [
    group.primaryResult.clientId,
    group.results.map((result) => result.clientId).join("|"),
    group.duplicateCandidates.map((candidate) => candidate.id).join("|"),
  ].join("::");
}

type ScanToTaskConflictListProps = {
  conflictGroups: ConflictGroup[];
  draftsById: Record<string, { title: string }>;
  onSelectResult: (resultId: string, source?: "queue" | "conflict") => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
  onStageMergeConflictItems: (group: ConflictGroup, selectedIds: string[], instructions?: string) => void;
  onStageDeleteConflictItems: (group: ConflictGroup, selectedIds: string[]) => void;
};

export function ScanToTaskConflictList({
  conflictGroups,
  draftsById,
  onSelectResult,
  onInspectTaskCandidate,
  onStageMergeConflictItems,
  onStageDeleteConflictItems,
}: ScanToTaskConflictListProps) {
  const { open, activeTitle } = useActionSidebar();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const lastOpenedPanelKeyRef = useRef<string | null>(null);

  const activeGroup = useMemo(
    () => conflictGroups.find((group) => group.primaryResult.clientId === activeGroupId) ?? null,
    [activeGroupId, conflictGroups],
  );

  useEffect(() => {
    if (activeTitle !== null) return;
    lastOpenedPanelKeyRef.current = null;
  }, [activeTitle]);

  const openConflictPanel = useCallback(
    (group: (typeof conflictGroups)[number]) => {
      const panelTitle = buildConflictPanelTitle(group);
      const panelContentKey = buildConflictPanelContentKey(group);
      if (lastOpenedPanelKeyRef.current === panelContentKey && activeTitle === panelTitle) {
        return;
      }

      setActiveGroupId(group.primaryResult.clientId);
      lastOpenedPanelKeyRef.current = panelContentKey;
      open(
        panelTitle,
        <ConflictActionsPanel
          key={panelContentKey}
          group={group}
          draftsById={draftsById}
          onMerge={onStageMergeConflictItems}
          onDelete={onStageDeleteConflictItems}
        />,
      );
    },
    [activeTitle, draftsById, onStageDeleteConflictItems, onStageMergeConflictItems, open],
  );

  useEffect(() => {
    if (!activeGroup) return;
    const panelTitle = buildConflictPanelTitle(activeGroup);
    if (activeTitle !== panelTitle) return;

    const panelContentKey = buildConflictPanelContentKey(activeGroup);
    if (lastOpenedPanelKeyRef.current === panelContentKey) return;

    lastOpenedPanelKeyRef.current = panelContentKey;
    open(
      panelTitle,
      <ConflictActionsPanel
        key={panelContentKey}
        group={activeGroup}
        draftsById={draftsById}
        onMerge={onStageMergeConflictItems}
        onDelete={onStageDeleteConflictItems}
      />,
    );
  }, [activeGroup, activeTitle, draftsById, onStageDeleteConflictItems, onStageMergeConflictItems, open]);

  if (conflictGroups.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-6">
      <ConflictListHeader groupCount={conflictGroups.length} />

      <div className="mt-4 max-h-112 space-y-2 overflow-y-auto pr-1 sm:max-h-128">
        {conflictGroups.map((group) => {
          const primaryResult = group.primaryResult;
          // Use the current draft buffer so labels follow the live editor state until the user saves.
          const titles = group.results.map((result) => draftsById[result.clientId]?.title ?? result.draft.title);
          const sourceLabel = group.results.length === 1 ? "1 draft" : `${group.results.length} drafts`;
          const taskCandidates = group.duplicateCandidates.filter((candidate) => candidate.sourceType === "task");
          const taskLabel = taskCandidates.length === 1 ? "1 task" : `${taskCandidates.length} tasks`;
          const panelTitle = buildConflictPanelTitle(group);
          const panelIsActive = activeTitle === panelTitle;

          return (
            <div key={primaryResult.clientId} className="flex items-start gap-2">
              <details className="group flex-1 overflow-hidden rounded-xl border border-amber-500/15 bg-background/90 text-foreground shadow-sm">
                <ConflictItemRow
                  primaryResult={primaryResult}
                  titles={titles}
                  sourceLabel={sourceLabel}
                  taskLabel={taskLabel}
                  taskCount={taskCandidates.length}
                />
                <ConflictItemDetails
                  primaryResult={primaryResult}
                  results={group.results}
                  duplicateCandidates={group.duplicateCandidates}
                  onSelectResult={onSelectResult}
                  onInspectTaskCandidate={onInspectTaskCandidate}
                />
              </details>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={
                  panelIsActive
                    ? "mt-3 h-8 w-8 shrink-0 border border-amber-500/20 bg-amber-500/10 px-0 text-amber-700 hover:bg-amber-500/15 hover:text-amber-800 dark:text-amber-200"
                    : "mt-3 h-8 w-8 shrink-0 px-0 text-muted-foreground hover:bg-amber-500/10 hover:text-foreground"
                }
                aria-label="Conflict item options"
                onClick={(event) => {
                  event.stopPropagation();
                  openConflictPanel(group);
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type ConflictItemRowProps = {
  primaryResult: DraftScanResultItem & { ok: true };
  titles: string[];
  sourceLabel: string;
  taskLabel: string;
  taskCount: number;
};

function formatItemTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function ConflictItemRow({
  primaryResult,
  titles,
  sourceLabel,
  taskLabel,
  taskCount,
}: ConflictItemRowProps) {
  return (
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 outline-none transition-colors hover:bg-amber-500/5 [&::-webkit-details-marker]:hidden">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 transition-transform group-open:rotate-180 dark:text-amber-200">
        <ChevronDown className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{titles[0] ?? primaryResult.fileName}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {sourceLabel}
          </span>
          {taskCount > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-200">
              {taskLabel}
            </span>
          ) : null}
        </div>

        <p className="mt-1 truncate text-xs text-muted-foreground">{primaryResult.fileName}</p>
      </div>
    </summary>
  );
}

type ConflictItemDetailsProps = {
  primaryResult: DraftScanResultItem & { ok: true };
  results: Array<Extract<DraftScanResultItem, { ok: true }>>;
  duplicateCandidates: TaskDuplicateCandidate[];
  onSelectResult: (resultId: string, source?: "queue" | "conflict") => void;
  onInspectTaskCandidate: (resultId: string, taskId: string) => void;
};

function ConflictItemDetails({
  primaryResult,
  results,
  duplicateCandidates,
  onSelectResult,
  onInspectTaskCandidate,
}: ConflictItemDetailsProps) {
  const taskCandidates = duplicateCandidates.filter((candidate) => candidate.sourceType === "task");

  return (
    <div className="border-t border-amber-500/10 px-4 py-4">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Drafts</p>
          <div className="mt-2 space-y-2">
            {results.map((result) => (
              <button
                key={result.clientId}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/5"
                onClick={() => onSelectResult(result.clientId, "conflict")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{result.draft.title}</span>
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {formatItemTimestamp(result.createdAt) ?? "-"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tasks</p>
          <div className="mt-2 space-y-2">
            {taskCandidates.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                variant="ghost"
                className="flex h-auto w-full items-center justify-between gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-left transition-colors hover:border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => {
                  const taskId = candidate.taskId ?? candidate.id;
                  onInspectTaskCandidate(primaryResult.clientId, taskId);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{candidate.name}</span>
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {formatItemTimestamp(candidate.createdAt) ?? "-"}
                  </span>
                </span>
              </Button>
            ))}
            {taskCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No matching tasks were found for this conflict.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type ConflictListHeaderProps = {
  groupCount: number;
};

function ConflictListHeader({ groupCount }: ConflictListHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-amber-500/10 pb-3">
      <div>
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-200">
          <ListChecks className="h-3.5 w-3.5" />
          <h2 className="text-sm font-semibold">Conflict list</h2>
        </div>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-200">
          Each group combines related drafts and existing tasks into one target.
        </p>
      </div>
      <div className="text-xs text-amber-700 dark:text-amber-200">
        {groupCount} group{groupCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}