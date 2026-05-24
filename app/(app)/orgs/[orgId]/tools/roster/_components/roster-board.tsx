"use client";

/**
 *
 * Exports ROSTER_CELL_WIDTH / ROSTER_DAY_LABEL_WIDTH constants so a future
 * template-mode board can reuse the exact same grid structure.
 *
 * Row colors:
 *   RED    — no members rostered
 *   YELLOW — member count doesn't match recommendedSize
 *   GREEN  — filtered member is rostered on this day
 *   default (white/dark) — fully staffed
 */

import { cn } from "@/lib/utils";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { EditCellPanel } from "./edit-cell-dialog";
import { EditDayConfigPanel } from "./edit-day-config-dialog";
import {
  DAY_LABELS,
  ROSTER_CELL_WIDTH,
  ROSTER_DAY_LABEL_WIDTH,
  ROSTER_CELL_MIN_HEIGHT,
} from "./roster-board-constants";
import { formatMinutes, hoursWorked } from "../_utils/time-utils";
import type { SavedRosterEntry } from "@/lib/services/roster";

export type RosterEntryRow = {
  id: string;
  membershipId: string;
  weekStart: Date;
  dayIndex: number;
  shiftStartMin: number | null;
  shiftEndMin: number | null;
  membership: {
    id: string;
    botName: string | null;
    user: { name: string | null } | null;
  };
};

export type DayConfigRow = {
  dayIndex: number;
  recommendedSize: number;
  openTimeMin: number | null;
  closeTimeMin: number | null;
};

export type OrgMember = {
  id: string;
  botName: string | null;
  user: { name: string | null } | null;
};

export type RosterBoardProps = {
  orgId: string;
  entries: RosterEntryRow[];
  dayConfigs: DayConfigRow[];
  members: OrgMember[];
  weekStarts: Date[];
  todayMonday: number; // .getTime() of today's Monday
  todayDayIndex: number; // 0=Mon … 6=Sun in org timezone
  filterMembershipId: string | null;
  onFilterChange?: (id: string | null) => void;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
  /** Called after a cell is successfully saved so the parent can update its local entries state. */
  onCellSaved?: (
    weekStart: Date,
    dayIndex: number,
    entries: SavedRosterEntry[],
  ) => void;
};

function memberName(m: OrgMember): string {
  return m.botName ?? m.user?.name ?? "Unknown";
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const fmt = (d: Date) => `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function formatWeekDate(weekStart: Date, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function RosterBoard({
  orgId,
  entries,
  dayConfigs,
  members,
  weekStarts,
  todayMonday,
  todayDayIndex,
  filterMembershipId,
  orgOpenTimeMin,
  orgCloseTimeMin,
  onCellSaved,
}: RosterBoardProps) {
  const sidebar = useActionSidebar();

  // Build lookup: "weekStartMs-dayIndex" → RosterEntryRow[]
  const cellMap = new Map<string, RosterEntryRow[]>();
  for (const entry of entries) {
    const key = `${entry.weekStart.getTime()}-${entry.dayIndex}`;
    const existing = cellMap.get(key) ?? [];
    existing.push(entry);
    cellMap.set(key, existing);
  }

  // Day config lookup by dayIndex
  const configMap = new Map<number, DayConfigRow>();
  for (const cfg of dayConfigs) configMap.set(cfg.dayIndex, cfg);

  return (
    <div className="w-full">
      {/* ── Header row: week date ranges ── */}
      <div className="flex border-b border-border bg-muted/30 sticky top-0 z-10">
        {/* Spacer aligned with the day-label column */}
        <div
          className="shrink-0 border-r border-border"
          style={{ width: ROSTER_DAY_LABEL_WIDTH }}
        />
        {weekStarts.map((weekStart) => {
          const isThisWeek = weekStart.getTime() === todayMonday;
          return (
            <div
              key={weekStart.getTime()}
              className={cn(
                "flex-1 text-center text-xs font-medium py-2.5 border-r border-border",
                isThisWeek
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {formatWeekRange(weekStart)}
            </div>
          );
        })}
      </div>

      {/* ── Day rows ── */}
      {DAY_LABELS.map((label, dayIndex) => {
        const config = configMap.get(dayIndex);
        const recommendedSize = config?.recommendedSize ?? 1;
        const isLastDay = dayIndex === DAY_LABELS.length - 1;
        const isTodayRow = dayIndex === todayDayIndex;

        return (
          <div
            key={dayIndex}
            className={cn("flex", isLastDay ? "" : "border-b border-border")}
            style={{ minHeight: ROSTER_CELL_MIN_HEIGHT }}
          >
            {/* Day label — clicking opens day config editor */}
            <button
              className={cn(
                "shrink-0 flex flex-col items-start justify-center gap-0.5 px-3 py-2 border-r border-border hover:bg-muted/50 transition-colors text-left",
                isTodayRow && "bg-primary/8",
              )}
              style={{ width: ROSTER_DAY_LABEL_WIDTH }}
              onClick={() =>
                sidebar.open(
                  `Edit ${label} row`,
                  <EditDayConfigPanel
                    key={dayIndex}
                    orgId={orgId}
                    dayIndex={dayIndex}
                    config={config ?? null}
                    orgOpenTimeMin={orgOpenTimeMin}
                    orgCloseTimeMin={orgCloseTimeMin}
                  />,
                )
              }
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  isTodayRow && "text-primary",
                )}
              >
                {DAY_ABBR[dayIndex]}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  isTodayRow ? "text-primary/70" : "text-muted-foreground",
                )}
              >
                ×{recommendedSize} needed
              </span>
            </button>

            {/* Week cells */}
            {weekStarts.map((weekStart) => {
              const key = `${weekStart.getTime()}-${dayIndex}`;
              const cellEntries = cellMap.get(key) ?? [];
              const isToday = weekStart.getTime() === todayMonday;

              const isEmpty = cellEntries.length === 0;
              const isMismatch =
                !isEmpty && cellEntries.length !== recommendedSize;
              const isFiltered =
                filterMembershipId !== null &&
                cellEntries.some((e) => e.membershipId === filterMembershipId);

              const isTodayCell = isToday && isTodayRow;

              const bg = isFiltered
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : isEmpty
                  ? isTodayCell
                    ? "bg-red-100 dark:bg-red-900/40"
                    : "bg-red-50 dark:bg-red-950/40"
                  : isMismatch
                    ? isTodayCell
                      ? "bg-amber-100 dark:bg-amber-900/40"
                      : "bg-amber-50 dark:bg-amber-950/40"
                    : isTodayCell
                      ? "bg-primary/10"
                      : isToday
                        ? "bg-primary/5"
                        : isTodayRow
                          ? "bg-muted/30"
                          : "";

              return (
                <button
                  key={weekStart.getTime()}
                  className={cn(
                    "group flex-1 flex flex-col items-start justify-start gap-1 px-2 py-2 border-r border-border text-left transition-colors cursor-pointer hover:brightness-[0.93] dark:hover:brightness-125 min-w-0",
                    isToday && "border-l-2 border-l-primary/50",
                    bg,
                  )}
                  onClick={() =>
                    sidebar.open(
                      `${DAY_LABELS[dayIndex]}, ${formatWeekDate(weekStart, dayIndex)}`,
                      // Use Date.now() in key so the panel always mounts
                      // fresh with the latest currentEntries (never stale state).
                      <EditCellPanel
                        key={`${weekStart.getTime()}-${dayIndex}-${Date.now()}`}
                        orgId={orgId}
                        weekStart={weekStart}
                        dayIndex={dayIndex}
                        members={members}
                        currentEntries={cellEntries}
                        dayConfig={config ?? null}
                        orgOpenTimeMin={orgOpenTimeMin}
                        orgCloseTimeMin={orgCloseTimeMin}
                        onSaved={onCellSaved}
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
                      const isHighlighted =
                        filterMembershipId === e.membershipId;
                      return (
                        <span
                          key={e.id}
                          className={cn(
                            "inline-flex flex-col w-full rounded px-1.5 py-0.5 text-xs leading-tight truncate",
                            isHighlighted
                              ? "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 font-semibold"
                              : "bg-background/70 dark:bg-white/8",
                          )}
                        >
                          <span className="truncate">{name}</span>
                          {e.shiftStartMin !== null &&
                            e.shiftEndMin !== null && (
                              <span className="text-[10px] text-muted-foreground font-normal">
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
