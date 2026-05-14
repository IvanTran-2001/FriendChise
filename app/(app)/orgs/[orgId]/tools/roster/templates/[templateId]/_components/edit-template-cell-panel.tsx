"use client";

import { useState, useTransition } from "react";
import { Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { setRosterTemplateCellMembersAction } from "@/app/actions/roster";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import type { OrgMember } from "@/app/(app)/orgs/[orgId]/tools/roster/_components/roster-board";

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
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
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
  startTime: string;
  endTime: string;
};

export type TemplateEntryRow = {
  id: string;
  membershipId: string;
  weekIndex: number;
  dayIndex: number;
  shiftStartMin: number | null;
  shiftEndMin: number | null;
  membership: {
    id: string;
    botName: string | null;
    user: { name: string | null } | null;
  };
};

interface EditTemplateCellPanelProps {
  orgId: string;
  templateId: string;
  weekIndex: number;
  dayIndex: number;
  members: OrgMember[];
  currentEntries: TemplateEntryRow[];
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
}

export function EditTemplateCellPanel({
  orgId,
  templateId,
  weekIndex,
  dayIndex,
  members,
  currentEntries,
  orgOpenTimeMin,
  orgCloseTimeMin,
}: EditTemplateCellPanelProps) {
  const { close } = useActionSidebar();

  const defaultStart = minToTime(orgOpenTimeMin);
  const defaultEnd = minToTime(orgCloseTimeMin);

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
      const result = await setRosterTemplateCellMembersAction(
        orgId,
        templateId,
        weekIndex,
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
        {available.length > 0 && (
          <SearchableCombobox
            items={available.map((m) => ({ id: m.id, name: memberDisplayName(m) }))}
            onSelect={(item) => addMember(item.id)}
            triggerLabel="Add member…"
            placeholder="Search members…"
          />
        )}

        {shifts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No members assigned.</p>
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
                  <span className="text-[10px] text-muted-foreground">{worked}</span>
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
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
