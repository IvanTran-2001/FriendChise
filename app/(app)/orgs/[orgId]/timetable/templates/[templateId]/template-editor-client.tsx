"use client";

/**
 * @file template-editor-client.tsx
 * Client root for the timetable template editor page.
 *
 * Supports two view modes (persisted in localStorage via `usePersistedState`):
 * - **Calendar** — drag-and-drop time grid using `TimeGrid`. Tasks are dragged from
 *   the `TaskPanel` sidebar (desktop) or a bottom Sheet (mobile). Entries can be
 *   repositioned by dragging. Column count adapts to container width via ResizeObserver.
 * - **Simple** — day-by-day table sorted by start time. Clicking a row opens
 *   the `EditPopup` to adjust start time and assignees.
 *
 * Navigation controls:
 * - Day / Week span selector — switches between viewing one day or multiple days at once.
 * - Prev / Next / Start buttons — pages through the template cycle.
 * - +/- cycle buttons — extend or shrink `cycleLengthDays`; shrinking is blocked by the
 *   service layer if entries exist beyond the new length.
 *
 * `EditPopup` is an inline floating dialog that lets users adjust the start time and
 * assignees of any template entry. Changes commit immediately via server actions with
 * `router.refresh()` to sync server state.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutList, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  addTemplateInstanceAction,
  removeTemplateInstanceAction,
  updateTemplateInstanceAction,
  updateTemplateDaysAction,
  addInstanceAssigneeAction,
  removeInstanceAssigneeAction,
} from "@/app/actions/templates";
import { TimeGrid } from "../../_shared/time-grid";
import type { DragDataRef } from "../../_shared/time-grid";
import { TaskPanel } from "../../_shared/task-panel";
import { minToHHMM, hhmmToMin, minTo12h } from "../../_shared/grid-utils";
import type { SharedTask, SharedMembership } from "../../_shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTemplateInstance = {
  id: string;
  dayIndex: number;
  startTimeMin: number;
  taskColor?: string | null;
  task: { id: string; name: string; durationMin: number };
  assignees: Array<{
    id: string;
    membership: { id: string; user: { id: string; name: string | null } };
  }>;
};

export type ClientTask = SharedTask;
export type ClientMembership = SharedMembership;

// ---------------------------------------------------------------------------
// EditPopup (template-specific: no status field)
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
  const effectiveAddId = available.find((m) => m.id === addMembershipId)
    ? addMembershipId
    : (available[0]?.id ?? "");

  const parsedStartTime = hhmmToMin(startTime);
  const endMin =
    parsedStartTime == null
      ? null
      : parsedStartTime + instance.task.durationMin;

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === effectiveAddId);
    if (!membership) return;
    startT(async () => {
      const r = await addInstanceAssigneeAction(
        orgId,
        instance.id,
        effectiveAddId,
      );
      if (r.ok) {
        setLocalAssignees((p) => [
          ...p,
          { id: `opt-${effectiveAddId}`, membership },
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
        className="bg-background border shadow-2xl w-72 p-4 flex flex-col gap-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="font-semibold">{instance.task.name}</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
            {startTime} → {endMin == null ? "--:--" : minToHHMM(endMin)} ·{" "}
            {instance.task.durationMin} min
          </p>
        </div>

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
                className="flex items-center justify-between bg-muted/50 px-2 py-1 text-xs"
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
                value={effectiveAddId}
                onChange={(e) => setAddMembershipId(e.target.value)}
                className="flex-1 border px-2 py-1 text-xs bg-background"
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

        <div className="flex gap-2 pt-1 border-t">
          <Button
            size="sm"
            onClick={() => parsedStartTime != null && onSave(parsedStartTime)}
            disabled={parsedStartTime == null}
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
  fillHeight?: boolean;
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
  fillHeight,
}: TemplateEditorClientProps) {
  const router = useRouter();
  const [, startT] = useTransition();
  const isMobile = useIsMobile();

  // ── View mode (calendar / simple) ─────────────────────────────────────
  const [mode, setMode] = usePersistedState<"calendar" | "simple">(
    "template-editor:mode",
    "calendar",
  );

  // ── Span & adaptive column count (mirrors calendar-view) ──────────────
  const [span, setSpan] = useState<"day" | "week">("week");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]); // re-attach when switching back to calendar

  const rawColCount =
    span === "day"
      ? 1
      : Math.min(7, Math.max(1, Math.floor((containerWidth - 56) / 90)));
  const colCount =
    span === "day"
      ? 1
      : rawColCount % 2 === 0
        ? Math.max(1, rawColCount - 1)
        : rawColCount;

  // ── Day navigation ────────────────────────────────────────────────────
  const [startDay, setStartDay] = useState(0);

  // In simple mode page by 1 (day) or 7 (week); in calendar mode page by colCount.
  const pageSize = mode === "simple"
    ? (span === "day" ? 1 : 7)
    : colCount;

  // Clamp only to [0, templateDays-1] — allows partial last page.
  const clampedStartDay = Math.max(0, Math.min(startDay, templateDays - 1));

  const visibleEnd = Math.min(clampedStartDay + pageSize, templateDays);
  const visibleDays = Array.from(
    { length: visibleEnd - clampedStartDay },
    (_, i) => clampedStartDay + i,
  );
  const columns = visibleDays.map(String);

  const canPrev = clampedStartDay > 0;
  const canNext = visibleEnd < templateDays;
  const navLabel =
    visibleDays.length === 1
      ? `Day ${clampedStartDay + 1} of ${templateDays}`
      : `Day ${clampedStartDay + 1}–${visibleEnd} of ${templateDays}`;

  // ── Drag / tap / landscape state ─────────────────────────────────────
  type DragData =
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{
    column: string;
    timeMin: number;
  } | null>(null);
  const [editingInstance, setEditingInstance] =
    useState<ClientTemplateInstance | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Filter visible instances ──────────────────────────────────────────
  const visibleInstances = instances.filter((inst) =>
    visibleDays.includes(inst.dayIndex),
  );

  // ── Scroll anchor ─────────────────────────────────────────────────────
  let initialScrollMin = openTimeMin;
  for (const inst of visibleInstances) {
    if (inst.startTimeMin < initialScrollMin)
      initialScrollMin = inst.startTimeMin;
  }

  // ── Handlers ──────────────────────────────────────────────────────────
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
      router.refresh();
    });
  }

  function handleDrop(col: string, timeMin: number, data: DragData) {
    const day = parseInt(col, 10);
    startT(async () => {
      const result =
        data.type === "task"
          ? await addTemplateInstanceAction(
              orgId,
              templateId,
              data.taskId,
              day,
              timeMin,
            )
          : await updateTemplateInstanceAction(orgId, data.instanceId, {
              dayIndex: day,
              startTimeMin: timeMin,
            });
      if (!result.ok) return;
      router.refresh();
    });
  }

  function handleTapPlace(col: string, timeMin: number, taskId: string) {
    const day = parseInt(col, 10);
    startT(async () => {
      await addTemplateInstanceAction(orgId, templateId, taskId, day, timeMin);
      setSelectedTaskId(null);
      setTaskPanelOpen(false);
      router.refresh();
    });
  }

  function handleEditSave(startTimeMin: number) {
    if (!editingInstance) return;
    startT(async () => {
      const result = await updateTemplateInstanceAction(
        orgId,
        editingInstance.id,
        { startTimeMin },
      );
      if (!result.ok) return;
      setEditingInstance(null);
      router.refresh();
    });
  }

  function handleEditRemove() {
    if (!editingInstance) return;
    startT(async () => {
      const result = await removeTemplateInstanceAction(
        orgId,
        editingInstance.id,
      );
      if (!result.ok) return;
      setEditingInstance(null);
      router.refresh();
    });
  }

  return (
    <div
      className={
        fillHeight ? "flex flex-col flex-1 min-h-0" : "flex flex-col gap-4"
      }
    >
      {/* ── Toolbar (same two-row pattern as TimetableClient) ── */}
      <div className="-mx-4 -mt-4 mb-4 border-b bg-card px-4 py-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:-mx-6 sm:-mt-6 sm:mb-4 sm:px-6">
        {/* Row 1 (always): prev / day label / next + Start */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setStartDay(Math.max(0, clampedStartDay - pageSize))}
              disabled={!canPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-44 text-center px-1">
              {navLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setStartDay(clampedStartDay + pageSize)
              }
              disabled={!canNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs shrink-0 transition-opacity duration-200${clampedStartDay === 0 ? " opacity-0 pointer-events-none" : ""}`}
            onClick={() => setStartDay(0)}
            disabled={clampedStartDay === 0}
          >
            Start
          </Button>
        </div>

        {/* Row 2 (mobile) / same row (sm+): span picker + cycle controls */}
        <div className="flex flex-wrap items-center gap-2 sm:flex-1 sm:justify-end">
          <SegmentedControl
            size="sm"
            value={span}
            onChange={setSpan}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
            ]}
          />
          <SegmentedControl
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "calendar", label: "Calendar" },
              { value: "simple", label: "Simple" },
            ]}
          />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleRemoveDay}
              disabled={templateDays <= 1}
              title="Remove last day"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground min-w-14 text-center">
              {templateDays} day{templateDays !== 1 ? "s" : ""}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleAddDay}
              title="Add day"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Simple list view ── */}
      {mode === "simple" && (() => {
        // visibleDays already accounts for span + clamped navigation
        return (
          <div className={`flex flex-col gap-4${fillHeight ? " flex-1 overflow-y-auto min-h-0" : ""}`}>
            {visibleDays.map((dayIdx) => {
              const dayInstances = [...instances]
                .filter((inst) => inst.dayIndex === dayIdx)
                .sort((a, b) => a.startTimeMin - b.startTimeMin);
              return (
                <div key={dayIdx} className="rounded-xl border shadow-sm overflow-hidden bg-card shrink-0">
                    <div className="px-4 py-2.5 flex items-center gap-2 font-semibold text-sm border-b bg-muted/20">
                      Day {dayIdx + 1}
                    </div>
                    {dayInstances.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-muted-foreground">No tasks scheduled</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/20">
                          <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                            <th className="px-3 py-1.5 text-left font-medium w-8">#</th>
                            <th className="px-3 py-1.5 text-left font-medium">Time</th>
                            <th className="px-3 py-1.5 text-left font-medium">Task</th>
                            <th className="px-3 py-1.5 text-left font-medium">Duration</th>
                            <th className="px-3 py-1.5 text-left font-medium">Assigned To</th>
                            <th className="px-3 py-1.5 w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {dayInstances.map((inst, idx) => {
                            const assigneeNames =
                              inst.assignees
                                .map((a) => a.membership.user.name ?? "Unknown")
                                .join(", ") || "—";
                            return (
                              <tr
                                key={inst.id}
                                onClick={() => setEditingInstance(inst)}
                                className="hover:bg-primary/5 active:bg-primary/10 transition-colors cursor-pointer"
                              >
                                <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                                <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                                  {minTo12h(inst.startTimeMin)}
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ background: inst.taskColor ?? "#9ca3af" }}
                                    />
                                    {inst.task.name}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">
                                  {inst.task.durationMin} min
                                </td>
                                <td className="px-3 py-2 text-muted-foreground text-xs">
                                  {assigneeNames}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingInstance(inst); }}
                                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors cursor-pointer text-muted-foreground"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
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
      })()}

      {/* ── Grid + desktop panel ── */}
      {mode === "calendar" && (
      <div className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}>
        <div
          ref={containerRef}
          className={`relative flex-1 min-w-0${fillHeight ? " min-h-0 flex flex-col" : ""}`}
        >
          {/* Empty state — hidden during tap-to-place and drag */}
          {!visibleInstances.length && !isDragging && !selectedTaskId && (
            <div className="absolute inset-0 z-20 flex items-center justify-center border bg-background/90">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {colCount === 1
                    ? `No slots on day ${startDay + 1}`
                    : "No slots in this range"}
                </p>
                {isMobile ? (
                  <button
                    onClick={() => setTaskPanelOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-md px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform"
                  >
                    <Plus className="h-4 w-4" />
                    Add task
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Drag a task from the panel to get started
                  </p>
                )}
              </div>
            </div>
          )}

          <TimeGrid
            columns={columns}
            instances={visibleInstances}
            getColumnKey={(inst) => String(inst.dayIndex)}
            renderColumnHeader={(col) => (
              <>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Day
                </div>
                <div className="text-base font-bold leading-none mt-0.5">
                  {parseInt(col, 10) + 1}
                </div>
              </>
            )}
            renderBlock={(inst, heightPx) => {
              const assigneeNames = inst.assignees
                .map((a) => a.membership.user.name?.split(" ")[0] ?? "?")
                .join(", ");
              return (
                <>
                  <div className="text-[10px] text-muted-foreground font-mono leading-none mb-0.5">
                    {minToHHMM(inst.startTimeMin)}
                  </div>
                  <div className="font-semibold truncate">{inst.task.name}</div>
                  {heightPx >= 60 && assigneeNames && (
                    <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {assigneeNames}
                    </div>
                  )}
                </>
              );
            }}
            dragDataRef={dragDataRef as DragDataRef}
            onDragOver={(col, timeMin) => setDragOver({ column: col, timeMin })}
            onDrop={handleDrop}
            onDragLeave={() => setDragOver(null)}
            dragOver={dragOver}
            onBlockMenuClick={setEditingInstance}
            draggable
            initialScrollMin={initialScrollMin}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            fillHeight={fillHeight}
            blockColor={(inst) => inst.taskColor ?? undefined}
            selectedTaskId={isMobile ? selectedTaskId : null}
            onTapPlace={isMobile ? handleTapPlace : undefined}
          />
        </div>

        {/* Desktop task panel */}
        {!isMobile && (
          <TaskPanel
            tasks={availableTasks}
            fillHeight={fillHeight}
            onDragStart={(taskId, e) => {
              dragDataRef.current = { type: "task", taskId };
              e.dataTransfer.effectAllowed = "copy";
              setIsDragging(true);
            }}
            onDragEnd={() => {
              dragDataRef.current = null;
              setDragOver(null);
              setIsDragging(false);
            }}
          />
        )}
      </div>
      )}

      {/* Mobile: floating Tasks button + Sheet */}
      {isMobile && (
        <>
          {selectedTaskId ? (
            <button
              onClick={() => setSelectedTaskId(null)}
              className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground shadow-lg px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform"
              style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
              aria-label="Cancel task placement"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setTaskPanelOpen(true)}
              className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform"
              style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
              aria-label="Open task list"
            >
              <LayoutList className="h-4 w-4" />
              Tasks
            </button>
          )}

          <Sheet open={taskPanelOpen} onOpenChange={setTaskPanelOpen}>
            <SheetContent
              side={isLandscape ? "right" : "bottom"}
              className={
                isLandscape
                  ? "w-64 p-0 flex flex-col"
                  : "data-[side=bottom]:h-[80dvh] p-0 flex flex-col"
              }
            >
              <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
                <SheetTitle>Tasks</SheetTitle>
              </SheetHeader>
              <TaskPanel
                tasks={availableTasks}
                fullWidth={true}
                fillHeight={true}
                tapToPlaceMode={true}
                selectedTaskId={selectedTaskId}
                onTaskSelect={(taskId) => {
                  setSelectedTaskId(taskId);
                  if (taskId) setTaskPanelOpen(false);
                }}
                onDragStart={(taskId, e) => {
                  dragDataRef.current = { type: "task", taskId };
                  e.dataTransfer.effectAllowed = "copy";
                  setIsDragging(true);
                }}
                onDragEnd={() => {
                  dragDataRef.current = null;
                  setDragOver(null);
                  setTaskPanelOpen(false);
                  setIsDragging(false);
                }}
              />
            </SheetContent>
          </Sheet>
        </>
      )}

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
    </div>
  );
}
