"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/layout/toolbar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTimetableInstance = {
  id: string;
  taskId: string;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  task: {
    id: string;
    title: string;
    durationMin: number;
    preferredStartTimeMin: number | null;
  };
  assignees: Array<{
    id: string;
    membership: {
      id: string;
      user: { id: string; name: string | null };
    };
  }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 64; // px per hour

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const STATUS_LABELS: Record<ClientTimetableInstance["status"], string> = {
  TODO: "TODO",
  IN_PROGRESS: "IN PROG",
  DONE: "DONE",
  SKIPPED: "SKIP",
};

// ---------------------------------------------------------------------------
// Date utilities — UTC-based to match server-side week computation
// ---------------------------------------------------------------------------

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

function isToday(dateStr: string): boolean {
  return new Date().toISOString().split("T")[0] === dateStr;
}

function formatDateRange(weekStart: string): string {
  const s = new Date(weekStart + "T00:00:00Z");
  const e = new Date(addDays(weekStart, 6) + "T00:00:00Z");
  return `${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCDate()} \u2013 ${MONTH_NAMES[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

/** Groups instances by UTC date string (YYYY-MM-DD). */
function groupByDate(
  instances: ClientTimetableInstance[],
): Map<string, ClientTimetableInstance[]> {
  const map = new Map<string, ClientTimetableInstance[]>();
  for (const inst of instances) {
    if (!inst.scheduledStartAt) continue;
    const key = inst.scheduledStartAt.split("T")[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inst);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------

function statusBlockClass(status: ClientTimetableInstance["status"]): string {
  switch (status) {
    case "TODO":        return "bg-slate-300/80 text-slate-800 border-slate-400";
    case "IN_PROGRESS": return "bg-amber-300/80 text-amber-900 border-amber-400";
    case "DONE":        return "bg-green-300/80 text-green-900 border-green-400";
    case "SKIPPED":     return "bg-red-300/80 text-red-900 border-red-400";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "TODO":        return "bg-slate-200 text-slate-600";
    case "IN_PROGRESS": return "bg-amber-100 text-amber-700";
    case "DONE":        return "bg-green-100 text-green-700";
    case "SKIPPED":     return "bg-red-100 text-red-700";
    default:            return "bg-slate-100 text-slate-600";
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "TODO":        return "bg-slate-400";
    case "IN_PROGRESS": return "bg-amber-500";
    case "DONE":        return "bg-green-500";
    case "SKIPPED":     return "bg-red-500";
    default:            return "bg-slate-400";
  }
}

// ---------------------------------------------------------------------------
// Column-overlap layout for the calendar view
// ---------------------------------------------------------------------------

type PositionedInstance = {
  instance: ClientTimetableInstance;
  col: number;
  totalCols: number;
};

/**
 * Assigns non-overlapping column slots to instances within a single day.
 * Overlapping tasks share the column width proportionally so they're both
 * visible side by side.
 */
function assignColumns(
  dayInstances: ClientTimetableInstance[],
  openTimeMin: number,
): PositionedInstance[] {
  const sorted = [...dayInstances].sort((a, b) => {
    const ta = a.scheduledStartAt ? new Date(a.scheduledStartAt).getTime() : 0;
    const tb = b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : 0;
    return ta - tb;
  });

  // colEnds[i] = the UTC minute at which column i last becomes free
  const colEnds: number[] = [];

  const positioned = sorted.map((inst) => {
    const start = inst.scheduledStartAt ? new Date(inst.scheduledStartAt) : null;
    const startMin = start
      ? start.getUTCHours() * 60 + start.getUTCMinutes()
      : openTimeMin;
    const endMin = startMin + inst.task.durationMin;

    let col = colEnds.findIndex((e) => e <= startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMin);
    } else {
      colEnds[col] = endMin;
    }

    return { instance: inst, col, totalCols: 0 };
  });

  const totalCols = Math.max(colEnds.length, 1);
  return positioned.map((p) => ({ ...p, totalCols }));
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  instances: ClientTimetableInstance[];
  weekStart: string;
  openTimeMin: number;
  closeTimeMin: number;
}

function CalendarView({
  instances,
  weekStart,
  openTimeMin,
  closeTimeMin,
}: CalendarViewProps) {
  const startHour = Math.floor(openTimeMin / 60);
  const endHour = Math.ceil(closeTimeMin / 60);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const totalHeight = hours.length * HOUR_HEIGHT;
  const byDate = groupByDate(instances);

  return (
    <div className="rounded-xl border-2 border-purple-400 overflow-hidden">
      {/* Day-name header */}
      <div className="flex border-b-2 border-purple-300 bg-purple-100">
        <div className="w-14 shrink-0 border-r border-purple-300" />
        {days.map((dayStr, i) => {
          const d = new Date(dayStr + "T00:00:00Z");
          const today = isToday(dayStr);
          return (
            <div
              key={dayStr}
              className={`flex-1 py-2 text-center text-sm border-r border-purple-300 last:border-r-0 ${
                today ? "bg-blue-200 text-blue-800" : "text-slate-700"
              }`}
            >
              <div className="font-medium">{DAY_NAMES[i]}</div>
              <div
                className={`text-lg font-bold leading-none mt-0.5 ${
                  today ? "text-blue-700" : ""
                }`}
              >
                {d.getUTCDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto bg-purple-50/40" style={{ maxHeight: 520 }}>
        <div className="flex" style={{ height: totalHeight }}>
          {/* Hour-label gutter */}
          <div className="w-14 shrink-0 border-r border-purple-200">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b border-purple-200/50 select-none"
              >
                {`${h}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((dayStr) => {
            const dayInstances = byDate.get(dayStr) ?? [];
            const positioned = assignColumns(dayInstances, openTimeMin);
            const today = isToday(dayStr);

            return (
              <div
                key={dayStr}
                className={`flex-1 relative border-r border-purple-300 last:border-r-0 ${
                  today ? "bg-blue-50/50" : ""
                }`}
                style={{ height: totalHeight }}
              >
                {/* Background hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-b border-purple-200/50"
                    style={{ top: (h - startHour) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Task blocks */}
                {positioned.map(({ instance: inst, col, totalCols }) => {
                  const startDate = new Date(inst.scheduledStartAt!);
                  const startMin =
                    startDate.getUTCHours() * 60 + startDate.getUTCMinutes();
                  const topPx = Math.max(
                    ((startMin - startHour * 60) / 60) * HOUR_HEIGHT,
                    0,
                  );
                  const heightPx = Math.max(
                    (inst.task.durationMin / 60) * HOUR_HEIGHT,
                    20,
                  );
                  const widthPct = 100 / totalCols;
                  const leftPct = col * widthPct;
                  const assigneeNames = inst.assignees
                    .map((a) => a.membership.user.name?.split(" ")[0] ?? "?")
                    .join(", ");

                  return (
                    <div
                      key={inst.id}
                      className={`absolute rounded border overflow-hidden p-1 text-[11px] leading-snug cursor-pointer hover:opacity-90 transition-opacity ${statusBlockClass(inst.status)}`}
                      style={{
                        top: topPx + 1,
                        height: Math.max(heightPx - 2, 18),
                        left: `${leftPct + 0.5}%`,
                        width: `${widthPct - 1}%`,
                      }}
                      title={`${inst.task.title} — ${inst.task.durationMin} min`}
                    >
                      <div className="font-semibold truncate">{inst.task.title}</div>
                      {heightPx >= 36 && assigneeNames && (
                        <div className="truncate opacity-80">{assigneeNames}</div>
                      )}
                      {heightPx >= 52 && (
                        <div className="opacity-60 text-[10px]">
                          • {STATUS_LABELS[inst.status]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SimpleView
// ---------------------------------------------------------------------------

interface SimpleViewProps {
  instances: ClientTimetableInstance[];
  weekStart: string;
}

function SimpleView({ instances, weekStart }: SimpleViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDate = groupByDate(instances);

  return (
    <div className="flex flex-col gap-4">
      {days.map((dayStr, dayIdx) => {
        const d = new Date(dayStr + "T00:00:00Z");
        const today = isToday(dayStr);
        const dayInstances = byDate.get(dayStr) ?? [];
        const dayLabel = `${DAY_NAMES[dayIdx]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;

        return (
          <div key={dayStr} className="rounded-xl border overflow-hidden">
            {/* Day header */}
            <div
              className={`px-4 py-2.5 flex items-center gap-2 font-semibold text-sm border-b ${
                today
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-muted/50"
              }`}
            >
              {dayLabel}
              {today && (
                <span className="text-xs font-normal text-blue-500 ml-1">
                  Today
                </span>
              )}
            </div>

            {dayInstances.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No tasks scheduled
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/20">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-3 py-1.5 text-left font-medium w-8">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Task</th>
                    <th className="px-3 py-1.5 text-left font-medium">Duration</th>
                    <th className="px-3 py-1.5 text-left font-medium">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dayInstances.map((inst, idx) => {
                    const assigneeNames =
                      inst.assignees
                        .map((a) => a.membership.user.name ?? "Unknown")
                        .join(", ") || "\u2014";
                    const isSkipped = inst.status === "SKIPPED";

                    return (
                      <tr
                        key={inst.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(inst.status)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusDotClass(inst.status)}`}
                            />
                            {STATUS_LABELS[inst.status]}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 font-medium ${
                            isSkipped
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {inst.task.title}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {inst.task.durationMin} min
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {assigneeNames}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface TimetableClientProps {
  orgId: string;
  instances: ClientTimetableInstance[];
  weekStart: string;
  openTimeMin: number;
  closeTimeMin: number;
  mode: "calendar" | "simple";
}

export function TimetableClient({
  orgId,
  instances,
  weekStart,
  openTimeMin,
  closeTimeMin,
  mode,
}: TimetableClientProps) {
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const dateRangeLabel = formatDateRange(weekStart);

  const makeHref = (w: string, m: string) =>
    `/orgs/${orgId}/timetable?week=${w}&mode=${m}`;

  return (
    <div className="flex flex-col gap-4">
      <Toolbar actions={[{ label: "Templates", href: `/orgs/${orgId}/timetable/templates` }]}>
        {/* Week-view type (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Week <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Templates (placeholder — cycle/template logic TBD) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Templates <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Filter (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Filter <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Calendar / Simple toggle */}
        <div className="flex rounded-md overflow-hidden border text-sm font-medium">
          <Link
            href={makeHref(weekStart, "calendar")}
            className={`px-3 py-1 transition-colors ${
              mode === "calendar"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            Calendar
          </Link>
          <Link
            href={makeHref(weekStart, "simple")}
            className={`px-3 py-1 border-l transition-colors ${
              mode === "simple"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            Simple
          </Link>
        </div>
      </Toolbar>

      {/* Week navigation */}
      <div className="flex items-center justify-between rounded-lg border px-4 py-1.5">
        <Link href={makeHref(prevWeek, mode)}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
        </Link>
        <span className="text-sm font-medium">{dateRangeLabel}</span>
        <Link href={makeHref(nextWeek, mode)}>
          <Button variant="ghost" size="sm" className="gap-1">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* View */}
      {mode === "calendar" ? (
        <CalendarView
          instances={instances}
          weekStart={weekStart}
          openTimeMin={openTimeMin}
          closeTimeMin={closeTimeMin}
        />
      ) : (
        <SimpleView instances={instances} weekStart={weekStart} />
      )}
    </div>
  );
}
