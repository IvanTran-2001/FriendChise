"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import { addInstanceAssigneeAction, removeInstanceAssigneeAction, updateTemplateInstanceAction, removeTemplateInstanceAction } from "@/app/actions/templates";
import { minToHHMM, hhmmToMin } from "../../../_shared/grid-utils";
import type { ClientTemplateInstance, ClientMembership } from "../template-editor-client";

interface CalendarEditSidebarContentProps {
  instance: ClientTemplateInstance;
  taskColor?: string;
  memberships: ClientMembership[];
  orgId: string;
  onClose: () => void;
  onBack?: () => void;
  /** Optional initial values when opening the editor for a proposed move. */
  initialDayIndex?: number;
  initialStartTimeMin?: number;
}

export function CalendarEditSidebarContent({
  instance,
  taskColor,
  memberships,
  orgId,
  onClose,
  onBack,
  initialDayIndex,
  initialStartTimeMin,
}: CalendarEditSidebarContentProps) {
  const router = useRouter();
  // Prefill from the proposed target day/time so the user sees the drag result
  // before saving, while `instance` remains the source of truth for diffs.
  const [startTime, setStartTime] = useState(minToHHMM(initialStartTimeMin ?? instance.startTimeMin));
  const [dayIndex] = useState<number | null>(initialDayIndex ?? instance.dayIndex);
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [, startT] = useTransition();

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));

  function loadMemberships(search: string, page: number, signal: AbortSignal) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "10");
    if (search.trim()) params.set("search", search.trim());
    for (const id of assignedIds) params.append("excludeIds", id);

    return fetch(`/api/orgs/${orgId}/memberships?${params.toString()}`, { signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load assignees.");
        const data = (await response.json()) as {
          memberships: ComboboxItem[];
          hasMore: boolean;
        };
        return { items: data.memberships, hasMore: data.hasMore };
      });
  }

  const parsedStartTime = hhmmToMin(startTime);
  const endMin = parsedStartTime == null ? null : parsedStartTime + instance.task.durationMin;

  function handleAddAssignee(membershipId: string) {
    const membership = memberships.find((m) => m.id === membershipId);
    if (!membership) return;
    startT(async () => {
      const r = await addInstanceAssigneeAction(orgId, instance.id, membershipId);
      if (r.ok) {
        setLocalAssignees((p) => [
          ...p,
          { id: `opt-${membershipId}`, membership: { ...membership, botName: membership.botName ?? null } },
        ]);
        router.refresh();
      }
    });
  }

  function handleRemoveAssignee(membershipId: string) {
    startT(async () => {
      const r = await removeInstanceAssigneeAction(orgId, instance.id, membershipId);
      if (r.ok) {
        setLocalAssignees((p) => p.filter((a) => a.membership.id !== membershipId));
        router.refresh();
      }
    });
  }

  function handleSave() {
    if (parsedStartTime == null) return;
    startT(async () => {
      try {
        const update: { startTimeMin?: number; dayIndex?: number } = { startTimeMin: parsedStartTime };
        if (dayIndex != null && dayIndex !== instance.dayIndex) update.dayIndex = dayIndex;
        const result = await updateTemplateInstanceAction(orgId, instance.id, update);
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong");
          return;
        }
        router.refresh();
        (onBack ?? onClose)();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleRemove() {
    startT(async () => {
      const result = await removeTemplateInstanceAction(orgId, instance.id);
      if (!result.ok) return;
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-4">

        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors -mb-2 self-start"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}

        {/* Task meta */}
        <div
          className="rounded-lg border bg-card px-3 py-2.5 flex items-center gap-2.5"
          style={{ borderLeftWidth: 3, borderLeftColor: taskColor ?? instance.taskColor ?? "#9ca3af" }}
        >
          <span className="font-semibold text-sm truncate">{instance.task.name}</span>
        </div>

        {/* Start time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-8 w-32 rounded border border-input bg-background px-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {startTime} → {endMin == null ? "--:--" : minToHHMM(endMin)} · {instance.task.durationMin} min
          </p>
        </div>

        {/* Assignees */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignees</label>
          {localAssignees.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No one assigned</span>
          )}
          <div className="flex flex-col gap-1">
            {localAssignees.map((a) => (
              <div key={a.membership.id} className="flex items-center justify-between bg-muted/40 rounded px-2.5 py-1.5 text-sm">
                <span>{a.membership.user?.name ?? a.membership.botName ?? "Unknown"}</span>
                <button
                  onClick={() => handleRemoveAssignee(a.membership.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                  aria-label={`Remove assignee ${a.membership.user?.name ?? a.membership.botName ?? a.membership.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <SearchableCombobox
            items={[]}
            loadItems={loadMemberships}
            onSelect={(item) => handleAddAssignee(item.id)}
            triggerLabel="Add assignee"
            placeholder="Search members…"
            emptyText="No matching members"
            disabled={assignedIds.size >= memberships.length}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Button size="sm" onClick={handleSave} disabled={parsedStartTime == null} className="flex-1 h-8">
            Save
          </Button>
          <Button size="sm" variant="destructive" onClick={handleRemove} className="h-8">
            Remove
          </Button>
        </div>

      </div>
    </div>
  );
}
