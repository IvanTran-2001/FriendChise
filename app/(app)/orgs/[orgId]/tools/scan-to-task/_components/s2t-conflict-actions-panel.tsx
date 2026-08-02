"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import type { ConflictGroup } from "./s2t-helpers";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";

type ConflictActionsPanelProps = {
  group: ConflictGroup;
  draftsById: Record<string, { title: string }>;
  onMerge: (group: ConflictGroup, selectedIds: string[], instructions?: string) => void;
  onDelete: (group: ConflictGroup, selectedIds: string[]) => void;
};

type ConflictItem = {
  id: string;
  label: string;
  sourceType: "draft" | "task";
  createdAt?: string;
  updatedAt?: string;
};

function formatItemTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function ConflictActionsPanel({ group, draftsById, onMerge, onDelete }: ConflictActionsPanelProps) {
  const { close } = useActionSidebar();
  // Build the same draft/task split the conflict list uses: real draft rows,
  // plus only true task candidates from the duplicate set.
  const draftItems = useMemo<ConflictItem[]>(
    () =>
      group.results.map((result) => ({
        id: `draft:${result.clientId}`,
        label: draftsById[result.clientId]?.title ?? result.draft.title,
        sourceType: "draft" as const,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      })),
    [draftsById, group.results],
  );

  const taskItems = useMemo<ConflictItem[]>(
    () =>
      group.duplicateCandidates
        .filter((candidate) => candidate.sourceType === "task")
        .map((candidate) => ({
          id: `task:${candidate.taskId ?? candidate.id}`,
          label: candidate.name,
          sourceType: "task" as const,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
        })),
    [group.duplicateCandidates],
  );

  const items = [...draftItems, ...taskItems];

  // Start with every item selected so the user can narrow the action down from the full conflict set.
  const [selectedIds, setSelectedIds] = useState<string[]>(() => items.map((item) => item.id));
  const [instructions, setInstructions] = useState("");
  // Only draft items can be merged into a new task draft.
  const selectedDraftIds = selectedIds.filter((id) => id.startsWith("draft:"));
  // Delete works on any selected item, merge requires at least one draft.
  const canDelete = selectedIds.length > 0;
  const canMerge = selectedDraftIds.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ConflictSummaryHeader draftCount={draftItems.length} taskCount={taskItems.length} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Instructions</p>
            <textarea
              value={instructions}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInstructions(event.currentTarget.value)}
              placeholder="Add notes for how the merged draft should be shaped..."
              className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          </div>

          {draftItems.length > 0 ? (
            <ConflictItemSection
              title="Drafts"
              items={draftItems}
              selectedIds={selectedIds}
              onToggle={(itemId, checked) => {
                // Add or remove this item from the current selection.
                setSelectedIds((current) =>
                  checked ? [...current, itemId] : current.filter((selectedId) => selectedId !== itemId),
                );
              }}
            />
          ) : null}

          {taskItems.length > 0 ? (
            <ConflictItemSection
              title="Tasks"
              items={taskItems}
              selectedIds={selectedIds}
              onToggle={(itemId, checked) => {
                // Add or remove this item from the current selection.
                setSelectedIds((current) =>
                  checked ? [...current, itemId] : current.filter((selectedId) => selectedId !== itemId),
                );
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            // Execute merge for the selected drafts, then close the sidebar.
            onClick={() => {
              onMerge(group, selectedIds, instructions);
              close();
            }}
            disabled={!canMerge}
          >
            Merge
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            // Execute delete for the selected items, then close the sidebar.
            onClick={() => {
              onDelete(group, selectedIds);
              close();
            }}
            disabled={!canDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

type ConflictSummaryHeaderProps = {
  draftCount: number;
  taskCount: number;
};
function ConflictSummaryHeader({ draftCount, taskCount }: ConflictSummaryHeaderProps) {
  return (
    <div className="border-b border-border px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Conflict items</p>
      {/* Summarize how many drafts and tasks participate in this conflict group. */}
      <p className="mt-1 text-sm text-foreground">
        {draftCount} draft{draftCount === 1 ? "" : "s"} and {taskCount} task{taskCount === 1 ? "" : "s"} involved.
      </p>
    </div>
  );
}

type ConflictItemCheckboxListProps = {
  items: ConflictItem[];
  selectedIds: string[];
  onToggle: (itemId: string, checked: boolean) => void;
};

function ConflictItemSection({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: ConflictItem[];
  selectedIds: string[];
  onToggle: (itemId: string, checked: boolean) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <ConflictItemCheckboxList items={items} selectedIds={selectedIds} onToggle={onToggle} />
    </div>
  );
}

function ConflictItemCheckboxList({ items, selectedIds, onToggle }: ConflictItemCheckboxListProps) {
  return (
    <div className="mt-2 space-y-2">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);

        return (
          <label
            key={item.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition-colors",
              checked
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-border/70 bg-muted/20 hover:border-amber-500/20 hover:bg-amber-500/5",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-amber-600"
              checked={checked}
              onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {formatItemTimestamp(item.createdAt) ?? "-"}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}