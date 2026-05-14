"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { setRosterCellMembersAction } from "@/app/actions/roster";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import type { RosterEntryRow, OrgMember, DayConfigRow } from "./roster-board";

function memberDisplayName(m: OrgMember): string {
  return m.botName ?? m.user?.name ?? "Unknown";
}

function minToTime(min: number | null): string {
  if (min === null) return "";
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMin(time: string): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function hoursWorked(startMin: number | null, endMin: number | null): string {
  if (startMin === null || endMin === null) return "";
  const diff = endMin - startMin;
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type MemberShift = {
  membershipId: string;
  startTime: string; // "HH:MM"
  endTime: string;
};

interface EditCellPanelProps {
  orgId: string;
  weekStart: Date;
  dayIndex: number;
  members: OrgMember[];
  currentEntries: RosterEntryRow[];
  dayConfig: DayConfigRow | null;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
}

export function EditCellPanel({
  orgId,
  weekStart,
  dayIndex,
  members,
  currentEntries,
  dayConfig,
  orgOpenTimeMin,
  orgCloseTimeMin,
}: EditCellPanelProps) {
  const { close } = useActionSidebar();

  // Default shift = day config times, falling back to org times
  const defaultStart = minToTime(dayConfig?.openTimeMin ?? orgOpenTimeMin);
  const defaultEnd = minToTime(dayConfig?.closeTimeMin ?? orgCloseTimeMin);

  const [shifts, setShifts] = useState<MemberShift[]>(
    currentEntries.map((e) => ({
      membershipId: e.membershipId,
      startTime: minToTime(e.shiftStartMin) || defaultStart,
      endTime: minToTime(e.shiftEndMin) || defaultEnd,
    })),
  );
  const [isPending, startTransition] = useTransition();

  const selectedIds = shifts.map((s) => s.membershipId);
  const available = members.filter((m) => !selectedIds.includes(m.id));

  function addMember(id: string) {
    setShifts((prev) => [
      ...prev,
      { membershipId: id, startTime: defaultStart, endTime: defaultEnd },
    ]);
  }

  function removeMember(id: string) {
    setShifts((prev) => prev.filter((s) => s.membershipId !== id));
  }

  function updateShift(id: string, field: "startTime" | "endTime", value: string) {
    setShifts((prev) =>
      prev.map((s) => (s.membershipId === id ? { ...s, [field]: value } : s)),
    );
  }

  function handleSave() {
    startTransition(async () => {
      const result = await setRosterCellMembersAction(
        orgId,
        weekStart,
        dayIndex,
        shifts.map((s) => ({
          membershipId: s.membershipId,
          shiftStartMin: timeToMin(s.startTime),
          shiftEndMin: timeToMin(s.endTime),
        })),
      );
      if (result.ok) {
        close();
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
        {/* Member picker */}
        {available.length > 0 && (
          <SearchableCombobox
            items={available.map((m) => ({ id: m.id, name: memberDisplayName(m) }))}
            onSelect={(item) => addMember(item.id)}
            triggerLabel="Add member…"
            placeholder="Search members…"
          />
        )}

        {/* Rostered members with shift times */}
        {shifts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No members rostered.
          </p>
        ) : (
          shifts.map((s) => {
            const member = members.find((m) => m.id === s.membershipId);
            if (!member) return null;
            const worked = hoursWorked(timeToMin(s.startTime), timeToMin(s.endTime));
            return (
              <div key={s.membershipId} className="flex flex-col gap-2 rounded-md border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium break-words min-w-0">{memberDisplayName(member)}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(s.membershipId)}
                    className="shrink-0 mt-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-8 shrink-0">Start</label>
                    <Input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => updateShift(s.membershipId, "startTime", e.target.value)}
                      className="h-8 text-sm px-2 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-8 shrink-0">End</label>
                    <Input
                      type="time"
                      value={s.endTime}
                      onChange={(e) => updateShift(s.membershipId, "endTime", e.target.value)}
                      className="h-8 text-sm px-2 flex-1"
                    />
                  </div>
                </div>
                {worked && (
                  <p className="text-xs text-muted-foreground text-right">{worked}</p>
                )}
              </div>
            );
          })
        )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={close}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
