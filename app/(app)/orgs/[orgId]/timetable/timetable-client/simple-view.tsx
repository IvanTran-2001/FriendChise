"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Title no longer links to task detail here; use the icon button instead.
import { CalendarDays, ExternalLink } from "lucide-react";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { toast } from "sonner";
import {
  updateTimetableEntryAction,
  createTimetableEntryAction,
} from "@/app/actions/timetable-entries";
import { cn } from "@/lib/utils";
import {
  addDays,
  getDayName,
  getMonthName,
  groupBy,
  minTo12h,
} from "../_shared/grid-utils";
import {
  statusDotClass,
  getMondayOf,
} from "./helpers";
import { CalendarEditSidebarContent } from "./calendar-edit-sidebar-content";
import type { ClientTimetableInstance, ClientMembership } from "./types";

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// SimpleView
// ---------------------------------------------------------------------------

interface SimpleViewProps {
  instances: ClientTimetableInstance[];
  /** Centre of the 13-day window. */
  anchor: string;
  /** "day" shows only the anchor day; "week" shows Mon–Sun anchored to the week's Monday. */
  span?: "day" | "week";
  todayStr: string;
  canManage: boolean;
  memberships?: ClientMembership[];
  orgId: string;
}

export function SimpleView({
  instances,
  anchor,
  span = "week",
  todayStr,
  canManage,
  memberships,
  orgId,
}: SimpleViewProps) {
  const router = useRouter();
  const actionSidebar = useActionSidebar();
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr
      ? "SKIPPED"
      : inst.status;
  }
  const days =
    span === "day"
      ? [anchor]
      : (() => {
          const weekStart = getMondayOf(anchor);
          return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        })();
  const visibleSet = new Set(days);
  const visibleInstances = instances.filter((inst) =>
    visibleSet.has(inst.date),
  );
  const byDate = groupBy(instances, (inst) => inst.date);

  if (visibleInstances.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
        <div className="flex flex-col items-center gap-3 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-xl font-semibold text-foreground">
            {span === "day" ? "No tasks today" : "No tasks this week"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {days.map((dayStr) => {
          const d = new Date(dayStr + "T00:00:00Z");
          const today = dayStr === todayStr;
          const dayInstances = byDate.get(dayStr) ?? [];
          const sortedDayInstances = [...dayInstances].sort((a, b) => {
            if (a.startTimeMin !== b.startTimeMin) return a.startTimeMin - b.startTimeMin;
            return (a.task?.durationMin ?? 0) - (b.task?.durationMin ?? 0);
          });
          const dayLabel = `${getDayName(dayStr)}, ${getMonthName(d.getUTCMonth())} ${d.getUTCDate()}`;

          return (
            <div
              key={dayStr}
              className={`rounded-xl border shadow-sm overflow-hidden ${today ? "border-primary/40 bg-card ring-1 ring-primary/20" : "bg-card"}`}
              onDragOver={(e) => {
                if (!canManage) return;
                e.preventDefault();
                setDragOverDay(dayStr);
              }}
              onDragLeave={() => setDragOverDay((d) => (d === dayStr ? null : d))}
              onDrop={(e) => {
                if (!canManage) return;
                e.preventDefault();
                setDragOverDay(null);

                // Priority: task drags use a dedicated key so TimeGrid/AddTaskPanel can
                // drop tasks into this list. Fallback to JSON payloads for instance moves.
                const taskId = e.dataTransfer.getData("timetable/taskId");
                if (taskId) {
                  // Simple view has no precise time Y coordinate — use 09:00 as a sensible default.
                  const defaultStartMin = 9 * 60;
                  startTransition(async () => {
                    const res = await createTimetableEntryAction(orgId, taskId, dayStr, defaultStartMin);
                    if (!res.ok) {
                      toast.error(res.error ?? "Failed to add task to timetable");
                      return;
                    }
                    router.refresh();
                  });
                  return;
                }

                // Fallback: parse JSON payloads for move/group semantics.
                const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed?.type === "move" && parsed?.instanceId) {
                    const instanceId = parsed.instanceId as string;
                    startTransition(async () => {
                      const res = await updateTimetableEntryAction(orgId, instanceId, { dateStr: dayStr });
                      if (!res.ok) {
                        toast.error(res.error ?? "Failed to move entry");
                        return;
                      }
                      router.refresh();
                    });
                  }
                  // Note: group drag support (parsed.type === 'group') can be added later.
                } catch {
                  // ignore parse errors
                }
              }}
            >
              <div
                className={cn(
                          // Note: group drag support (parsed.type === 'group') can be added later.
                today
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted/20",
              )}
              >
                {dayLabel}
                {today && (
                  <span className="text-xs font-normal text-primary/70 ml-1">
                    Today
                  </span>
                )}
              </div>

              {sortedDayInstances.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No tasks scheduled
                </div>
              ) : (
                <div className="divide-y">
                  {sortedDayInstances.map((inst) => {
                    const effectiveStatus = effStatus(inst);
                    const isSkipped = effectiveStatus === "SKIPPED";
                    const isDone = effectiveStatus === "DONE";
                    return (
                      <div
                        key={inst.id}
                        draggable={canManage}
                        // Drag start: encode a simple JSON payload describing the
                        // instance move. `TimeGrid` uses a richer DragData shape, but
                        // for SimpleView we only need `type: 'move'` + `instanceId`.
                        onDragStart={(e) => {
                          if (!canManage) return;
                          e.stopPropagation();
                          e.dataTransfer.setData("application/json", JSON.stringify({ type: "move", instanceId: inst.id }));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "group flex items-center gap-3 px-4 py-3 transition-colors",
                          memberships
                            ? "cursor-pointer hover:bg-primary/5 active:bg-primary/10"
                            : "",
                          dragOverDay === dayStr ? "ring-2 ring-primary/20" : ""
                        )}
                        // Single-click opens the edit UI in the ActionSidebar (not
                        // a full page). The little icon button is used to open the
                        // task detail page instead.
                        onClick={() => {
                          if (!memberships) return;
                          actionSidebar.open(
                            inst.task.title,
                            <CalendarEditSidebarContent
                              key={inst.id}
                              instance={inst}
                              memberships={memberships}
                              orgId={orgId}
                              canManage={canManage}
                              onClose={() => actionSidebar.close()}
                              onRefresh={() => router.refresh()}
                              router={router}
                              todayStr={todayStr}
                            />,
                          );
                        }}
                      >
                        {/* Task color accent */}
                        <div
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{
                            backgroundColor: inst.taskColor ?? "#94a3b8",
                          }}
                        />

                        {/* Time */}
                        <span className="text-xs text-muted-foreground font-mono w-14 shrink-0 tabular-nums">
                          {minTo12h(inst.startTimeMin)}
                        </span>

                        {/* Task name */}
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              "text-sm font-medium block truncate",
                              isSkipped || isDone ? "text-muted-foreground" : "",
                              isSkipped ? "line-through" : "",
                            )}
                          >
                            {inst.task.title}
                          </div>
                        </div>

                        {/* Assignee initials */}
                        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                          {inst.assignees.length === 0 ? (
                            <span className="text-xs text-muted-foreground/50">
                              —
                            </span>
                          ) : (
                            <>
                              {inst.assignees.slice(0, 3).map((a) => {
                                const name =
                                  a.membership.user?.name ??
                                  a.membership.botName ??
                                  "?";
                                const initials = name
                                  .trim()
                                  .split(/\s+/)
                                  .map((w) => w[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase();
                                return (
                                  <span
                                    key={a.id}
                                    title={name}
                                    className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center"
                                  >
                                    {initials}
                                  </span>
                                );
                              })}
                              {inst.assignees.length > 3 && (
                                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                                  +{inst.assignees.length - 3}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Duration */}
                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                          {formatDuration(inst.task.durationMin)}
                        </span>

                        {/* Status badge (sm+) / dot (mobile) */}
                        <span
                          className={cn(
                            "hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
                            effectiveStatus === "IN_PROGRESS"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : effectiveStatus === "DONE"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : effectiveStatus === "SKIPPED"
                                  ? "bg-red-500/10 text-red-500"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {effectiveStatus === "IN_PROGRESS"
                            ? "In progress"
                            : effectiveStatus === "DONE"
                              ? "Done"
                              : effectiveStatus === "SKIPPED"
                                ? "Skipped"
                                : "To do"}
                        </span>
                        <span className="sm:hidden inline-flex items-center gap-1 shrink-0">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotClass(effectiveStatus),
                            )}
                            aria-hidden="true"
                          />
                          <span className="text-xs text-muted-foreground">
                            {effectiveStatus === "IN_PROGRESS"
                              ? "In"
                              : effectiveStatus === "DONE"
                                ? "Done"
                                : effectiveStatus === "SKIPPED"
                                  ? "Skip"
                                  : "To do"}
                          </span>
                        </span>

                        {/* Edit button */}
                        {memberships && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`);
                            }}
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors shrink-0 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                            aria-label="Open task"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit panel is opened in the ActionSidebar via row click */}
    </>
  );
}
