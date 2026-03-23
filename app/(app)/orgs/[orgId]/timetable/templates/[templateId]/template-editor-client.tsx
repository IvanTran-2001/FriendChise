"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, X, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addTemplateInstanceAction,
  removeTemplateInstanceAction,
  updateTemplateInstanceAction,
  updateTemplateDaysAction,
  addInstanceAssigneeAction,
  removeInstanceAssigneeAction,
} from "@/app/actions/templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTemplateInstance = {
  id: string;
  dayOffset: number;
  startTimeMin: number;
  task: { id: string; title: string; durationMin: number };
  assignees: Array<{
    id: string;
    membership: { id: string; user: { id: string; name: string | null } };
  }>;
};

export type ClientTask = { id: string; title: string; durationMin: number };
export type ClientMembership = {
  id: string;
  user: { id: string; name: string | null };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 64;
const SNAP_MIN = 15;
const DAYS_PER_PAGE = 7;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function snapMin(raw: number): number {
  return Math.max(0, Math.min(1439, Math.round(raw / SNAP_MIN) * SNAP_MIN));
}

function calcDropTimeMin(
  clientY: number,
  colEl: Element,
  startHour: number,
  offsetMin = 0,
): number {
  const rect = colEl.getBoundingClientRect();
  return snapMin(
    ((clientY - rect.top) / HOUR_HEIGHT) * 60 + startHour * 60 - offsetMin,
  );
}

type PositionedInstance = {
  instance: ClientTemplateInstance;
  col: number;
  totalCols: number;
};

function assignColumns(
  instances: ClientTemplateInstance[],
): PositionedInstance[] {
  const sorted = [...instances].sort((a, b) => a.startTimeMin - b.startTimeMin);
  const colEnds: number[] = [];

  const positioned = sorted.map((inst) => {
    const endMin = inst.startTimeMin + inst.task.durationMin;
    let col = colEnds.findIndex((e) => e <= inst.startTimeMin);
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
// EditPopup
// ---------------------------------------------------------------------------

interface EditPopupProps {
  instance: ClientTemplateInstance;
  memberships: ClientMembership[];
  orgId: string;
  onSave: (startTimeMin: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

function EditPopup({
  instance,
  memberships,
  orgId,
  onSave,
  onRemove,
  onClose,
}: EditPopupProps) {
  const router = useRouter();
  const [startTime, setStartTime] = useState(minToHHMM(instance.startTimeMin));
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [addMembershipId, setAddMembershipId] = useState("");
  const [, startT] = useTransition();

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));
  const available = memberships.filter((m) => !assignedIds.has(m.id));

  useEffect(() => {
    if (
      available.length > 0 &&
      !available.find((m) => m.id === addMembershipId)
    ) {
      setAddMembershipId(available[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAssignees]);

  const endMin = hhmmToMin(startTime) + instance.task.durationMin;

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === addMembershipId);
    if (!membership) return;
    startT(async () => {
      const r = await addInstanceAssigneeAction(
        orgId,
        instance.id,
        addMembershipId,
      );
      if (r.ok) {
        setLocalAssignees((p) => [
          ...p,
          { id: `opt-${addMembershipId}`, membership },
        ]);
        router.refresh();
      }
    });
  }

  function handleRemoveAssignee(membershipId: string) {
    startT(async () => {
      const r = await removeInstanceAssigneeAction(
        orgId,
        instance.id,
        membershipId,
      );
      if (r.ok) {
        setLocalAssignees((p) =>
          p.filter((a) => a.membership.id !== membershipId),
        );
        router.refresh();
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
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Start time
          </label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-8 w-32 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {startTime} → {minToHHMM(endMin)} · {instance.task.durationMin} min
          </p>
        </div>

        {/* Assignees */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">
            Assign
          </label>
          {localAssignees.length === 0 && (
            <span className="text-xs text-muted-foreground italic">
              No one assigned
            </span>
          )}
          <div className="flex flex-col gap-1">
            {localAssignees.map((a) => (
              <div
                key={a.membership.id}
                className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
              >
                <span>{a.membership.user.name ?? "Unknown"}</span>
                <button
                  onClick={() => handleRemoveAssignee(a.membership.id)}
                  className="text-muted-foreground hover:text-destructive ml-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {available.length > 0 && (
            <div className="flex gap-1 items-center mt-0.5">
              <select
                value={addMembershipId}
                onChange={(e) => setAddMembershipId(e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-xs bg-background"
              >
                {available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user.name ?? "Unknown"}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddAssignee}
                className="h-7 w-7 p-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-1 border-t">
          <Button
            size="sm"
            onClick={() => onSave(hhmmToMin(startTime))}
            className="flex-1 h-7"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onRemove}
            className="h-7"
          >
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface TemplateEditorClientProps {
  orgId: string;
  templateId: string;
  templateDays: number;
  instances: ClientTemplateInstance[];
  availableTasks: ClientTask[];
  memberships: ClientMembership[];
  openTimeMin: number;
  closeTimeMin: number;
}

export function TemplateEditorClient({
  orgId,
  templateId,
  templateDays,
  instances,
  availableTasks,
  memberships,
  openTimeMin,
  closeTimeMin,
}: TemplateEditorClientProps) {
  const router = useRouter();
  const [, startT] = useTransition();

  // Cycle page nav
  const totalPages = Math.ceil(templateDays / DAYS_PER_PAGE);
  const [page, setPage] = useState(0);
  const pageStart = page * DAYS_PER_PAGE;
  const pageEnd = Math.min(pageStart + DAYS_PER_PAGE, templateDays);
  const visibleDays = Array.from(
    { length: pageEnd - pageStart },
    (_, i) => pageStart + i + 1,
  );

  // Grid dimensions
  const startHour = Math.floor(openTimeMin / 60);
  const endHour = Math.ceil(closeTimeMin / 60);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Task search
  const [search, setSearch] = useState("");
  const filteredTasks = availableTasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Drag
  type DragData =
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{
    day: number;
    timeMin: number;
  } | null>(null);

  // Edit popup
  const [editingInstance, setEditingInstance] =
    useState<ClientTemplateInstance | null>(null);

  // Group by day
  const byDay = new Map<number, ClientTemplateInstance[]>();
  for (const inst of instances) {
    if (!byDay.has(inst.dayOffset)) byDay.set(inst.dayOffset, []);
    byDay.get(inst.dayOffset)!.push(inst);
  }

  function handleAddDay() {
    startT(async () => {
      await updateTemplateDaysAction(orgId, templateId, templateDays + 1);
      router.refresh();
    });
  }

  function handleRemoveDay() {
    if (templateDays <= 1) return;
    startT(async () => {
      await updateTemplateDaysAction(orgId, templateId, templateDays - 1);
      const newPages = Math.ceil((templateDays - 1) / DAYS_PER_PAGE);
      if (page >= newPages) setPage(Math.max(0, newPages - 1));
      router.refresh();
    });
  }

  function handleColumnDragOver(
    e: React.DragEvent<HTMLDivElement>,
    day: number,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect =
      dragDataRef.current?.type === "move" ? "move" : "copy";
    const offsetMin =
      dragDataRef.current?.type === "move" ? dragDataRef.current.offsetMin : 0;
    setDragOver({
      day,
      timeMin: calcDropTimeMin(
        e.clientY,
        e.currentTarget,
        startHour,
        offsetMin,
      ),
    });
  }

  function handleColumnDrop(e: React.DragEvent<HTMLDivElement>, day: number) {
    e.preventDefault();
    const data = dragDataRef.current;
    dragDataRef.current = null;
    setDragOver(null);
    if (!data) return;
    const offsetMin = data.type === "move" ? data.offsetMin : 0;
    const timeMin = calcDropTimeMin(
      e.clientY,
      e.currentTarget,
      startHour,
      offsetMin,
    );
    startT(async () => {
      if (data.type === "task") {
        await addTemplateInstanceAction(
          orgId,
          templateId,
          data.taskId,
          day,
          timeMin,
        );
      } else {
        await updateTemplateInstanceAction(orgId, data.instanceId, {
          dayOffset: day,
          startTimeMin: timeMin,
        });
      }
      router.refresh();
    });
  }

  function handleEditSave(startTimeMin: number) {
    if (!editingInstance) return;
    startT(async () => {
      await updateTemplateInstanceAction(orgId, editingInstance.id, {
        startTimeMin,
      });
      setEditingInstance(null);
      router.refresh();
    });
  }

  function handleEditRemove() {
    if (!editingInstance) return;
    startT(async () => {
      await removeTemplateInstanceAction(orgId, editingInstance.id);
      setEditingInstance(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-4">
        {/* ── Left: grid ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Cycle navigation */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              ◀ Prev
            </Button>
            <span className="text-sm font-medium">
              Cycle: {templateDays} Day{templateDays !== 1 ? "s" : ""}, Day{" "}
              {pageStart + 1}–{pageEnd}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next ▶
            </Button>
          </div>

          {/* Grid */}
          <div className="rounded-xl border-2 border-purple-400 overflow-hidden">
            {/* Day headers */}
            <div className="flex border-b-2 border-purple-300 bg-purple-100">
              <div className="w-14 shrink-0 border-r border-purple-300" />
              {visibleDays.map((day) => (
                <div
                  key={day}
                  className="flex-1 py-2 text-center border-r border-purple-300 last:border-r-0 text-slate-700"
                >
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Day
                  </div>
                  <div className="text-base font-bold leading-none mt-0.5">
                    {day}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div
              className="overflow-y-auto bg-purple-50/40"
              style={{ maxHeight: 520 }}
            >
              <div className="flex" style={{ height: totalHeight }}>
                {/* Hour gutter */}
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
                {visibleDays.map((day) => {
                  const dayInsts = byDay.get(day) ?? [];
                  const positioned = assignColumns(dayInsts);
                  const isDragTarget = dragOver?.day === day;

                  return (
                    <div
                      key={day}
                      className={`flex-1 relative border-r border-purple-300 last:border-r-0 transition-colors ${isDragTarget ? "bg-purple-100/70" : ""}`}
                      style={{ height: totalHeight }}
                      onDragOver={(e) => handleColumnDragOver(e, day)}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setDragOver(null);
                      }}
                      onDrop={(e) => handleColumnDrop(e, day)}
                    >
                      {/* Hour lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute inset-x-0 border-b border-purple-200/50 pointer-events-none"
                          style={{
                            top: (h - startHour) * HOUR_HEIGHT,
                            height: HOUR_HEIGHT,
                          }}
                        />
                      ))}

                      {/* Drop indicator */}
                      {isDragTarget && dragOver && (
                        <div
                          className="absolute inset-x-1 h-0.5 bg-purple-500 z-10 pointer-events-none rounded"
                          style={{
                            top:
                              ((dragOver.timeMin - startHour * 60) / 60) *
                              HOUR_HEIGHT,
                          }}
                        />
                      )}

                      {/* Task blocks */}
                      {positioned.map(({ instance: inst, col, totalCols }) => {
                        const topPx = Math.max(
                          ((inst.startTimeMin - startHour * 60) / 60) *
                            HOUR_HEIGHT,
                          0,
                        );
                        const heightPx = Math.max(
                          (inst.task.durationMin / 60) * HOUR_HEIGHT,
                          20,
                        );
                        const widthPct = 100 / totalCols;
                        const leftPct = col * widthPct;
                        return (
                          <div
                            key={inst.id}
                            draggable
                            onDragStart={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              dragDataRef.current = {
                                type: "move",
                                instanceId: inst.id,
                                offsetMin:
                                  ((e.clientY - rect.top) / HOUR_HEIGHT) * 60,
                              };
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              dragDataRef.current = null;
                              setDragOver(null);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingInstance(inst);
                            }}
                            className="absolute rounded border p-1 text-[11px] leading-snug cursor-grab active:cursor-grabbing bg-purple-300/80 text-purple-900 border-purple-400 hover:opacity-90 select-none overflow-hidden"
                            style={{
                              top: topPx + 1,
                              height: Math.max(heightPx - 2, 18),
                              left: `${leftPct + 0.5}%`,
                              width: `${widthPct - 1}%`,
                            }}
                            title="Drag to move · Double-click to edit"
                          >
                            <div className="font-semibold truncate">
                              {inst.task.title}
                            </div>
                            {heightPx >= 32 && (
                              <div className="opacity-70 text-[10px]">
                                {minToHHMM(inst.startTimeMin)}
                              </div>
                            )}
                            {heightPx >= 48 && inst.assignees.length > 0 && (
                              <div className="opacity-70 text-[10px] truncate">
                                {inst.assignees
                                  .map(
                                    (a) =>
                                      a.membership.user.name?.split(" ")[0],
                                  )
                                  .join(", ")}
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
        </div>

        {/* ── Right panel ── */}
        <div className="w-56 shrink-0 flex flex-col gap-3">
          {/* Cycle controls */}
          <div className="rounded-xl border p-3 flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cycle
            </div>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              onClick={handleAddDay}
            >
              <Plus className="h-3.5 w-3.5" /> Add Day
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2"
              onClick={handleRemoveDay}
              disabled={templateDays <= 1}
            >
              <Minus className="h-3.5 w-3.5" /> Remove Day
            </Button>
          </div>

          {/* Task list */}
          <div className="rounded-xl border flex flex-col overflow-hidden flex-1">
            <div className="px-3 py-2.5 font-medium text-sm border-b">
              Search
            </div>
            <div className="px-2 py-2 border-b">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredTasks.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground italic">
                  No tasks found
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      dragDataRef.current = { type: "task", taskId: task.id };
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => {
                      dragDataRef.current = null;
                      setDragOver(null);
                    }}
                    className="px-3 py-2.5 border-b last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-muted/30 transition-colors select-none"
                  >
                    <div className="text-sm font-medium">{task.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.durationMin} min
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit popup */}
      {editingInstance && (
        <EditPopup
          instance={editingInstance}
          memberships={memberships}
          orgId={orgId}
          onSave={handleEditSave}
          onRemove={handleEditRemove}
          onClose={() => setEditingInstance(null)}
        />
      )}
    </>
  );
}
