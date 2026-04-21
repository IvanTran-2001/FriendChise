"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import {
  addDays,
  getDayName,
  getMonthName,
  groupBy,
  minTo12h,
} from "../_shared/grid-utils";
import { STATUS_LABELS, statusDotClass, statusRowClass, getMondayOf } from "./helpers";
import { CalendarEditPopup } from "./calendar-edit-popup";
import type { ClientTimetableInstance, ClientMembership } from "./types";

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
  const [editingInstance, setEditingInstance] =
    useState<ClientTimetableInstance | null>(null);

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
      <div className="flex items-center justify-center border py-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-2xl font-semibold text-foreground">
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
          const dayLabel = `${getDayName(dayStr)}, ${getMonthName(d.getUTCMonth())} ${d.getUTCDate()}`;

          return (
            <div
              key={dayStr}
              className={`rounded-xl border shadow-sm overflow-hidden ${today ? "border-primary/40 bg-card ring-1 ring-primary/20" : "bg-card"}`}
            >
              <div
                className={`px-4 py-2.5 flex items-center gap-2 font-semibold text-sm border-b ${today ? "bg-primary/8 text-primary border-primary/20" : "bg-muted/20"}`}
              >
                {dayLabel}
                {today && (
                  <span className="text-xs font-normal text-primary/70 ml-1">
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
                      <th className="px-3 py-1.5 text-left font-medium w-8">
                        #
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Time
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Status
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Task
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Duration
                      </th>
                      <th className="px-3 py-1.5 text-left font-medium">
                        Assigned To
                      </th>
                      {memberships && <th className="px-3 py-1.5 w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dayInstances.map((inst, idx) => {
                      const assigneeNames =
                        inst.assignees
                          .map((a) => a.membership.user?.name ?? a.membership.botName ?? "Bot")
                          .join(", ") || "—";
                      const isSkipped = effStatus(inst) === "SKIPPED";
                      return (
                        <tr
                          key={inst.id}
                          onClick={() =>
                            memberships && setEditingInstance(inst)
                          }
                          className={`hover:bg-primary/5 active:bg-primary/10 transition-colors ${memberships ? "cursor-pointer" : ""} ${statusRowClass(effStatus(inst))}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                            {minTo12h(inst.startTimeMin)}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                              <span
                                className={`w-2 h-2 rounded-full ${statusDotClass(effStatus(inst))}`}
                              />
                              {STATUS_LABELS[effStatus(inst)]}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-2 font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}
                          >
                            <Link
                              href={`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {inst.task.title}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {inst.task.durationMin} min
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {assigneeNames}
                          </td>
                          {memberships && (
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingInstance(inst);
                                }}
                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                                aria-label="Edit"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
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

      {editingInstance && memberships && (
        <CalendarEditPopup
          instance={editingInstance}
          memberships={memberships}
          orgId={orgId}
          canManage={canManage}
          open={true}
          onClose={() => setEditingInstance(null)}
          onRefresh={() => router.refresh()}
          router={router}
          todayStr={todayStr}
        />
      )}
    </>
  );
}