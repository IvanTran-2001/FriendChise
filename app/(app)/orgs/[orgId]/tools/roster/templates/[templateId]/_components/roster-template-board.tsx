"use client";

import { cn } from "@/lib/core/utils";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import {
  DAY_LABELS,
  ROSTER_DAY_LABEL_WIDTH,
  ROSTER_CELL_MIN_HEIGHT,
} from "@/app/(app)/orgs/[orgId]/tools/roster/_components/roster-board-constants";
import {
  EditTemplateCellPanel,
  type TemplateEntryRow,
} from "./edit-template-cell-panel";
import type { OrgMember } from "@/app/(app)/orgs/[orgId]/tools/roster/_components/roster-board";
import {
  formatMinutes,
  hoursWorked,
} from "@/app/(app)/orgs/[orgId]/tools/roster/_utils/time-utils";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type RosterTemplateBoardProps = {
  orgId: string;
  templateId: string;
  entries: TemplateEntryRow[];
  members: OrgMember[];
  weekIndices: number[]; // e.g. [0, 1, 2] for a 3-week template
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
};

export function RosterTemplateBoard({
  orgId,
  templateId,
  entries,
  members,
  weekIndices,
  orgOpenTimeMin,
  orgCloseTimeMin,
}: RosterTemplateBoardProps) {
  const sidebar = useActionSidebar();

  // Build lookup: "weekIndex-dayIndex" → TemplateEntryRow[]
  const cellMap = new Map<string, TemplateEntryRow[]>();
  for (const entry of entries) {
    const key = `${entry.weekIndex}-${entry.dayIndex}`;
    const existing = cellMap.get(key) ?? [];
    existing.push(entry);
    cellMap.set(key, existing);
  }

  return (
    <div className="w-full">
      {/* ── Header row: week labels ── */}
      <div className="flex border-b border-border bg-muted/30 sticky top-0 z-10">
        <div
          className="shrink-0 border-r border-border"
          style={{ width: ROSTER_DAY_LABEL_WIDTH }}
        />
        {weekIndices.map((wi) => (
          <div
            key={wi}
            className="flex-1 text-center text-xs font-medium py-2.5 border-r border-border text-muted-foreground"
          >
            Week {wi + 1}
          </div>
        ))}
      </div>

      {/* ── Day rows ── */}
      {DAY_LABELS.map((label, dayIndex) => {
        const isLastDay = dayIndex === DAY_LABELS.length - 1;

        return (
          <div
            key={dayIndex}
            className={cn("flex", isLastDay ? "" : "border-b border-border")}
            style={{ minHeight: ROSTER_CELL_MIN_HEIGHT }}
          >
            {/* Day label (read-only in template mode) */}
            <div
              className="shrink-0 flex flex-col items-start justify-center gap-0.5 px-3 py-2 border-r border-border"
              style={{ width: ROSTER_DAY_LABEL_WIDTH }}
            >
              <span className="text-sm font-semibold">
                {DAY_ABBR[dayIndex]}
              </span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>

            {/* Week cells */}
            {weekIndices.map((wi) => {
              const key = `${wi}-${dayIndex}`;
              const cellEntries = cellMap.get(key) ?? [];
              const isEmpty = cellEntries.length === 0;

              return (
                <button
                  key={wi}
                  className={cn(
                    "group flex-1 flex flex-col items-start justify-start gap-1 px-2 py-2 border-r border-border text-left transition-colors cursor-pointer hover:brightness-[0.93] dark:hover:brightness-125 min-w-0",
                    isEmpty ? "bg-muted/20" : "",
                  )}
                  onClick={() =>
                    sidebar.open(
                      `${label} — Week ${wi + 1}`,
                      <EditTemplateCellPanel
                        key={`${wi}-${dayIndex}`}
                        orgId={orgId}
                        templateId={templateId}
                        weekIndex={wi}
                        dayIndex={dayIndex}
                        members={members}
                        currentEntries={cellEntries}
                        orgOpenTimeMin={orgOpenTimeMin}
                        orgCloseTimeMin={orgCloseTimeMin}
                      />,
                    )
                  }
                >
                  {isEmpty ? (
                    <span className="text-xs text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors mx-auto mt-auto mb-auto">
                      —
                    </span>
                  ) : (
                    cellEntries.map((e) => {
                      const name =
                        e.membership.botName ?? e.membership.user?.name ?? "?";
                      return (
                        <span
                          key={e.id}
                          className="inline-flex flex-col w-full rounded px-1.5 py-0.5 text-xs leading-tight truncate bg-background/70 dark:bg-white/8"
                        >
                          <span className="truncate">{name}</span>
                          {e.shiftStartMin !== null &&
                            e.shiftEndMin !== null && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatMinutes(e.shiftStartMin)}–
                                {formatMinutes(e.shiftEndMin)}
                                {" · "}
                                {hoursWorked(e.shiftStartMin, e.shiftEndMin)}
                              </span>
                            )}
                        </span>
                      );
                    })
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
