"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTimetableEntryAction,
  updateTimetableEntryAction,
  updateTimetableEntryStatusAction,
  deleteTimetableEntryAction,
  addTimetableEntryAssigneeAction,
  removeTimetableEntryAssigneeAction,
} from "@/app/actions/timetable-entries";
import { TimeGrid } from "./_shared/time-grid";
import { TaskPanel } from "./_shared/task-panel";
import {
  addDays,
  isToday,
  getDayName,
  getMonthName,
  formatWeekRange,
  groupBy,
  minToHHMM,
  hhmmToMin,
} from "./_shared/grid-utils";
import type { SharedTask } from "./_shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTask = SharedTask;
export type ClientMembership = {
  id: string;
  user: { id: string; name: string | null };
  roles: { id: string; name: string; color: string | null }[];
};

export type ClientTimetableInstance = {
  id: string;
  taskId: string;
  date: string;
  startTimeMin: number;
  isProjected?: boolean;
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
    membership: { id: string; user: { id: string; name: string | null } };
  }>;
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ClientTimetableInstance["status"], string> = {
  TODO: "TODO",
  IN_PROGRESS: "IN PROG",
  DONE: "DONE",
  SKIPPED: "SKIP",
};

function statusDotClass(status: string): string {
  switch (status) {
    case "TODO":        return "bg-slate-400";
    case "IN_PROGRESS": return "bg-amber-400";
    case "DONE":        return "bg-green-500";
    case "SKIPPED":     return "bg-red-400";
    default:            return "bg-slate-400";
  }
}

// ---------------------------------------------------------------------------
// CalendarEditPopup
// ---------------------------------------------------------------------------

interface CalendarEditPopupProps {
  instance: ClientTimetableInstance;
  memberships: ClientMembership[];
  orgId: string;
  canManage: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function CalendarEditPopup({ instance, memberships, orgId, canManage, onClose, onRefresh }: CalendarEditPopupProps) {
  const [startTime, setStartTime] = useState(minToHHMM(instance.startTimeMin));
  const [status, setStatus] = useState<ClientTimetableInstance["status"]>(instance.status);
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [addMembershipId, setAddMembershipId] = useState("");
  const [, startT] = useTransition();

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));
  const available = memberships.filter((m) => !assignedIds.has(m.id));
  const effectiveAddId = available.find((m) => m.id === addMembershipId)
    ? addMembershipId
    : (available[0]?.id ?? "");

  const parsedStart = hhmmToMin(startTime);
  const endMin = parsedStart == null ? null : parsedStart + instance.task.durationMin;

  function handleSave() {
    startT(async () => {
      if (canManage) {
        if (parsedStart == null) return;
        await updateTimetableEntryAction(orgId, instance.id, { startTimeMin: parsedStart, status });
      } else {
        await updateTimetableEntryStatusAction(orgId, instance.id, status);
      }
      onClose();
      onRefresh();
    });
  }

  function handleDelete() {
    startT(async () => {
      await deleteTimetableEntryAction(orgId, instance.id);
      onClose();
      onRefresh();
    });
  }

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === effectiveAddId);
    if (!membership) return;
    startT(async () => {
      const r = await addTimetableEntryAssigneeAction(orgId, instance.id, effectiveAddId);
      if (r.ok) {
        setLocalAssignees((p) => [...p, { id: `opt-${effectiveAddId}`, membership }]);
        onRefresh();
      }
    });
  }

  function handleRemoveAssignee(membershipId: string) {
    startT(async () => {
      const r = await removeTimetableEntryAssigneeAction(orgId, instance.id, membershipId);
      if (r.ok) {
        setLocalAssignees((p) => p.filter((a) => a.membership.id !== membershipId));
        onRefresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="bg-background rounded-xl border shadow-2xl w-72 p-4 flex flex-col gap-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="font-semibold">{instance.task.title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {canManage && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Start time</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 w-32 text-sm" />
            <p className="text-xs text-muted-foreground">
              {startTime} → {endMin == null ? "--:--" : minToHHMM(endMin)} · {instance.task.durationMin} min
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-weight">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ClientTimetableInstance["status"])}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>

        {canManage && <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">Assign</label>
          {localAssignees.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No one assigned</span>
          )}
          <div className="flex flex-col gap-1">
            {localAssignees.map((a) => (
              <div key={a.membership.id} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
                <span>{a.membership.user.name ?? "Unknown"}</span>
                <button onClick={() => handleRemoveAssignee(a.membership.id)} className="text-muted-foreground hover:text-destructive ml-2">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {available.length > 0 && (
            <div className="flex gap-1 items-center mt-0.5">
              <select
                value={effectiveAddId}
                onChange={(e) => setAddMembershipId(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-xs bg-background"
              >
                {available.map((m) => (
                  <option key={m.id} value={m.id}>{m.user.name ?? "Unknown"}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={handleAddAssignee} className="h-7 w-7 p-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>}

        <div className="flex gap-2 pt-1 border-t">
          <Button size="sm" onClick={handleSave} disabled={canManage && parsedStart == null} className="flex-1 h-7">Save</Button>
          {canManage && <Button size="sm" variant="destructive" onClick={handleDelete} className="h-7">Delete</Button>}
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  instances: ClientTimetableInstance[];
  weekStart: string;
  openTimeMin: number;
  fillHeight?: boolean;
  orgId: string;
  todayStr: string;
  canManage: boolean;
  availableTasks?: ClientTask[];
  memberships?: ClientMembership[];
}

function CalendarView({ instances, weekStart, openTimeMin, fillHeight, orgId, todayStr, canManage, availableTasks, memberships }: CalendarViewProps) {
  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr ? "SKIPPED" : inst.status;
  }
  const router = useRouter();
  const [, startT] = useTransition();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  type DragData = { type: "task"; taskId: string } | { type: "move"; instanceId: string; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{ column: string; timeMin: number } | null>(null);
  const [editingInstance, setEditingInstance] = useState<ClientTimetableInstance | null>(null);

  const hasPanel = !!availableTasks;

  let initialScrollMin = openTimeMin;
  for (const inst of instances) {
    if (inst.startTimeMin < initialScrollMin) initialScrollMin = inst.startTimeMin;
  }

  function handleDrop(col: string, timeMin: number, data: DragData) {
    startT(async () => {
      if (data.type === "task") {
        await createTimetableEntryAction(orgId, data.taskId, col, timeMin);
      } else {
        await updateTimetableEntryAction(orgId, data.instanceId, { startTimeMin: timeMin, dateStr: col });
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}>
        <TimeGrid
          columns={days}
          instances={instances}
          getColumnKey={(inst) => inst.date}
          renderColumnHeader={(dayStr) => {
            const d = new Date(dayStr + "T00:00:00Z");
            const today = isToday(dayStr);
            return (
              <>
                <div className="font-medium">{getDayName(dayStr)}</div>
                <div className={`text-lg font-bold leading-none mt-0.5 ${today ? "text-foreground" : ""}`}>
                  {d.getUTCDate()}
                </div>
              </>
            );
          }}
          renderBlock={(inst, heightPx) => {
            const assigneeNames = inst.assignees
              .map((a) => a.membership.user.name?.split(" ")[0] ?? "?")
              .join(", ");
            return (
              <>
                <div className="text-[10px] text-muted-foreground font-mono leading-none mb-0.5">
                  {minToHHMM(inst.startTimeMin)}
                </div>
                <div className="font-semibold truncate">{inst.task.title}</div>
                {heightPx >= 44 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(effStatus(inst))}`} />
                    <span className="truncate text-[10px] text-muted-foreground">{STATUS_LABELS[effStatus(inst)]}</span>
                  </div>
                )}
                {heightPx >= 60 && assigneeNames && (
                  <div className="truncate text-[10px] text-muted-foreground mt-0.5">{assigneeNames}</div>
                )}
              </>
            );
          }}
          dragDataRef={dragDataRef}
          onDragOver={(col, timeMin) => setDragOver({ column: col, timeMin })}
          onDrop={handleDrop}
          onDragLeave={() => setDragOver(null)}
          dragOver={dragOver}
          onBlockMenuClick={memberships ? setEditingInstance : undefined}
          draggable={hasPanel}
          initialScrollMin={initialScrollMin}
          fillHeight={fillHeight}
          columnHighlightClass={(dayStr) => (isToday(dayStr) ? "bg-muted text-foreground" : undefined)}
        />
        {hasPanel && (
          <TaskPanel
            tasks={availableTasks}
            fillHeight={fillHeight}
            onDragStart={(taskId, e) => {
              dragDataRef.current = { type: "task", taskId };
              e.dataTransfer.effectAllowed = "copy";
            }}
            onDragEnd={() => {
              dragDataRef.current = null;
              setDragOver(null);
            }}
          />
        )}
      </div>

      {editingInstance && memberships && (
        <CalendarEditPopup
          instance={editingInstance}
          memberships={memberships}
          orgId={orgId}
          canManage={canManage}
          onClose={() => setEditingInstance(null)}
          onRefresh={() => router.refresh()}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SimpleView
// ---------------------------------------------------------------------------

interface SimpleViewProps {
  instances: ClientTimetableInstance[];
  weekStart: string;
  todayStr: string;
  canManage: boolean;
  memberships?: ClientMembership[];
  orgId: string;
}

function SimpleView({ instances, weekStart, todayStr, canManage, memberships, orgId }: SimpleViewProps) {
  const router = useRouter();
  const [editingInstance, setEditingInstance] = useState<ClientTimetableInstance | null>(null);

  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr ? "SKIPPED" : inst.status;
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDate = groupBy(instances, (inst) => inst.date);

  return (
    <>
      <div className="flex flex-col gap-4">
        {days.map((dayStr) => {
        const d = new Date(dayStr + "T00:00:00Z");
        const today = isToday(dayStr);
        const dayInstances = byDate.get(dayStr) ?? [];
        const dayLabel = `${getDayName(dayStr)}, ${getMonthName(d.getUTCMonth())} ${d.getUTCDate()}`;

        return (
          <div key={dayStr} className="rounded-xl border overflow-hidden">
            <div className={`px-4 py-2.5 flex items-center gap-2 font-semibold text-sm border-b ${today ? "bg-muted/50 text-foreground border-border" : "bg-muted/20"}`}>
              {dayLabel}
              {today && <span className="text-xs font-normal text-muted-foreground ml-1">Today</span>}
            </div>

            {dayInstances.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No tasks scheduled</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/20">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-3 py-1.5 text-left font-medium w-8">#</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium">Task</th>
                    <th className="px-3 py-1.5 text-left font-medium">Duration</th>
                    <th className="px-3 py-1.5 text-left font-medium">Assigned To</th>
                    {memberships && <th className="px-3 py-1.5 w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dayInstances.map((inst, idx) => {
                    const assigneeNames =
                      inst.assignees.map((a) => a.membership.user.name ?? "Unknown").join(", ") || "—";
                    const isSkipped = effStatus(inst) === "SKIPPED";
                    return (
                      <tr key={inst.id} onClick={() => memberships && setEditingInstance(inst)} className={`hover:bg-muted/20 transition-colors ${memberships ? "cursor-pointer" : ""}`}>
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <span className={`w-2 h-2 rounded-full ${statusDotClass(effStatus(inst))}`} />
                            {STATUS_LABELS[effStatus(inst)]}
                          </span>
                        </td>
                        <td className={`px-3 py-2 font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                          {inst.task.title}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{inst.task.durationMin} min</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{assigneeNames}</td>
                        {memberships && (
                          <td className="px-2 py-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingInstance(inst); }}
                              className="flex items-center justify-center w-6 h-6 rounded bg-muted/50 text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
                              aria-label="Edit"
                            >
                              ···
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
        onClose={() => setEditingInstance(null)}
        onRefresh={() => router.refresh()}
      />
    )}
    </>
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
  fillHeight?: boolean;
  todayStr: string;
  roleId?: string | null;
  canManage?: boolean;
  availableTasks?: ClientTask[];
  memberships?: ClientMembership[];
}

export function TimetableClient({
  orgId,
  instances,
  weekStart,
  openTimeMin,
  closeTimeMin,
  mode,
  fillHeight,
  todayStr,
  roleId,
  canManage = false,
  availableTasks,
  memberships,
}: TimetableClientProps) {
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const makeHref = (w: string, m: string) => {
    const p = new URLSearchParams({ week: w, mode: m });
    if (roleId) p.set("roleId", roleId);
    return `/orgs/${orgId}/timetable?${p.toString()}`;
  };

  return (
    <div className={`flex flex-col gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}>
      <div className="flex items-center justify-between rounded-lg border px-4 py-1.5">
        <Link href={makeHref(prevWeek, mode)}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
        </Link>
        <span className="text-sm font-medium">{formatWeekRange(weekStart)}</span>
        <Link href={makeHref(nextWeek, mode)}>
          <Button variant="ghost" size="sm" className="gap-1">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {mode === "calendar" ? (
        <CalendarView
          instances={instances}
          weekStart={weekStart}
          openTimeMin={openTimeMin}
          fillHeight={fillHeight}
          orgId={orgId}
          todayStr={todayStr}
          canManage={canManage}
          availableTasks={availableTasks}
          memberships={memberships}
        />
      ) : (
        <SimpleView instances={instances} weekStart={weekStart} todayStr={todayStr} canManage={canManage} memberships={memberships} orgId={orgId} />
      )}
    </div>
  );
}
