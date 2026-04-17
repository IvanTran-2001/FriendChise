"use client";

/**
 * @file timetable-client.tsx
 * Main client component for the live timetable page.
 *
 * ## Architecture
 * `TimetableClient` is the root export. It renders one of two views:
 *   - `CalendarView` — a drag-and-drop time-grid (Mon–Sun columns).
 *   - `SimpleView`   — a compact day-grouped table.
 *
 * Both views share `CalendarEditPopup`, a Dialog that lets members update a
 * task's status, and lets MANAGE_TIMETABLE holders also move, reassign, or
 * delete it.
 *
 * ## Permission model
 * - `canManage` (derived from `MANAGE_TIMETABLE` on the server) gates:
 *     - Drag-to-move entries in CalendarView
 *     - The task sidebar (adding new entries)
 *     - The "Actions" dropdown in the toolbar
 *     - Full edit mode in CalendarEditPopup (vs. status-only for regular members)
 * - Any org member can open CalendarEditPopup to update a task's status.
 *
 * ## "Today" highlight
 * Uses `todayStr` (org-timezone YYYY-MM-DD from the server) rather than
 * `isToday()` (browser timezone) to stay consistent with the skip-display
 * logic (`effStatus`) and the date navigation.
 *
 * ## Skip display
 * `effStatus(inst)` returns `"SKIPPED"` for any `TODO` entry whose date is
 * before `todayStr`, giving a visual indication of overdue tasks without
 * mutating the database.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
  getDayName,
  getMonthName,
  formatWeekRange,
  groupBy,
  minToHHMM,
  minTo12h,
  hhmmToMin,
} from "./_shared/grid-utils";
import type { SharedTask } from "./_shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientTask = SharedTask;

/** A membership with its associated roles, used to populate assignee dropdowns. */
export type ClientMembership = {
  id: string;
  user: { id: string; name: string | null };
  roles: { id: string; name: string; color: string | null }[];
};

/**
 * A timetable entry shaped for client rendering.
 * Times (`startTimeMin`) are in local wall-clock minutes after UTC→local
 * conversion by the server page. `date` is a local YYYY-MM-DD string.
 * `isProjected` marks entries synthesised from a template that haven't
 * been persisted as live entries yet (future feature placeholder).
 */
export type ClientTimetableInstance = {
  id: string;
  taskId: string;
  date: string;
  startTimeMin: number;
  taskColor?: string | null;
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
    case "TODO":
      return "bg-slate-400";
    case "IN_PROGRESS":
      return "bg-amber-400";
    case "DONE":
      return "bg-green-500";
    case "SKIPPED":
      return "bg-red-400";
    default:
      return "bg-slate-400";
  }
}

function statusRowClass(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-l-2 border-l-amber-400";
    case "DONE":
      return "border-l-2 border-l-green-500";
    case "SKIPPED":
      return "border-l-2 border-l-red-400";
    default:
      return "border-l-2 border-l-transparent";
  }
}

// ---------------------------------------------------------------------------
// CalendarEditPopup
// ---------------------------------------------------------------------------

/**
 * Props for CalendarEditPopup.
 *
 * - `open`       — Controlled open state; the parent keeps an `editingInstance`
 *                  state and passes `open={!!editingInstance}`.
 * - `canManage`  — When `true`, shows full edit controls (time/date, assignees,
 *                  delete). When `false`, shows status-only controls.
 * - `onClose`    — Called when the dialog should dismiss (Escape, overlay click,
 *                  or successful save). Parent clears `editingInstance`.
 * - `onRefresh`  — Called after a successful mutation to trigger a server
 *                  re-render via `router.refresh()`.
 */
interface CalendarEditPopupProps {
  instance: ClientTimetableInstance;
  memberships: ClientMembership[];
  orgId: string;
  canManage: boolean;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}

function CalendarEditPopup({
  instance,
  memberships,
  orgId,
  canManage,
  open,
  onClose,
  onRefresh,
  router,
}: CalendarEditPopupProps) {
  const [startTime, setStartTime] = useState(minToHHMM(instance.startTimeMin));
  const [date, setDate] = useState(instance.date);
  const [status, setStatus] = useState<ClientTimetableInstance["status"]>(
    instance.status,
  );
  const [localAssignees, setLocalAssignees] = useState(instance.assignees);
  const [addMembershipId, setAddMembershipId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startT] = useTransition();

  const assignedIds = new Set(localAssignees.map((a) => a.membership.id));
  const available = memberships.filter((m) => !assignedIds.has(m.id));
  const effectiveAddId = available.find((m) => m.id === addMembershipId)
    ? addMembershipId
    : (available[0]?.id ?? "");

  const parsedStart = hhmmToMin(startTime);
  const endMin =
    parsedStart == null ? null : parsedStart + instance.task.durationMin;

  function handleSave() {
    startT(async () => {
      const result = canManage
        ? parsedStart == null
          ? { ok: false as const, error: "Invalid start time" }
          : await updateTimetableEntryAction(orgId, instance.id, {
              startTimeMin: parsedStart,
              status,
              dateStr: date !== instance.date ? date : undefined,
            })
        : await updateTimetableEntryStatusAction(orgId, instance.id, status);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onClose();

      // If the date has changed, navigate to the week containing the new date
      if (date !== instance.date) {
        const params = new URLSearchParams(window.location.search);
        const currentMode = params.get("mode") || "calendar";
        const currentSpan = params.get("span") || "week";
        const roleId = params.get("roleId");

        const newParams = new URLSearchParams({
          week: date,
          mode: currentMode,
          span: currentSpan,
        });
        if (roleId) newParams.set("roleId", roleId);
        if (currentSpan === "day") newParams.set("day", date);

        router.push(`/orgs/${orgId}/timetable?${newParams.toString()}`);
      } else {
        // Only refresh if the date has NOT changed
        onRefresh();
      }
    });
  }

  function handleDelete() {
    startT(async () => {
      const result = await deleteTimetableEntryAction(orgId, instance.id);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onClose();
      onRefresh();
    });
  }

  function handleAddAssignee() {
    const membership = memberships.find((m) => m.id === effectiveAddId);
    if (!membership) return;
    startT(async () => {
      const r = await addTimetableEntryAssigneeAction(
        orgId,
        instance.id,
        effectiveAddId,
      );
      if (r.ok) {
        setLocalAssignees((p) => [
          ...p,
          { id: `opt-${effectiveAddId}`, membership },
        ]);
        onRefresh();
      }
    });
  }

  function handleRemoveAssignee(membershipId: string) {
    startT(async () => {
      const r = await removeTimetableEntryAssigneeAction(
        orgId,
        instance.id,
        membershipId,
      );
      if (r.ok) {
        setLocalAssignees((p) =>
          p.filter((a) => a.membership.id !== membershipId),
        );
        onRefresh();
      }
    });
  }

  const isMobile = useIsMobile();

  const popupContent = (
    <div className="flex flex-col gap-3 p-4">
      {/* Status — always shown first so it's the primary action (#76) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">
          Status
        </label>
        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as ClientTimetableInstance["status"])
          }
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          autoFocus
        >
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
          <option value="SKIPPED">Skipped</option>
        </select>
      </div>

      {canManage && (
        <>
          {/* Date picker (#70) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-full text-sm"
            />
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
              {startTime} → {endMin == null ? "--:--" : minToHHMM(endMin)} ·{" "}
              {instance.task.durationMin} min
            </p>
          </div>
        </>
      )}

      {canManage && (
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
                value={effectiveAddId}
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
      )}

      <div className="flex gap-2 pt-1 border-t">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={(canManage && parsedStart == null) || isSaving}
          className="flex-1 h-7"
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {canManage && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-7"
          >
            Delete
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          disabled={isSaving}
          className="h-7"
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="h-[calc(100dvh-4rem)] p-0 flex flex-col rounded-t-2xl overflow-hidden"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <SheetTitle>{instance.task.title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{popupContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="w-72 p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>{instance.task.title}</DialogTitle>
        </DialogHeader>
        {popupContent}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

interface CalendarViewProps {
  instances: ClientTimetableInstance[];
  weekStart: string;
  openTimeMin: number;
  closeTimeMin?: number;
  fillHeight?: boolean;
  orgId: string;
  todayStr: string;
  canManage: boolean;
  availableTasks?: ClientTask[];
  memberships?: ClientMembership[];
  span?: "day" | "week";
  dayStr?: string;
}

function CalendarView({
  instances,
  weekStart,
  openTimeMin,
  closeTimeMin,
  fillHeight,
  orgId,
  todayStr,
  canManage,
  availableTasks,
  memberships,
  span = "week",
  dayStr,
}: CalendarViewProps) {
  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr
      ? "SKIPPED"
      : inst.status;
  }
  const router = useRouter();
  const [isDropPending, startT] = useTransition();
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );

  const allDays =
    span === "day" && dayStr
      ? [dayStr]
      : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Adaptive column count for week span on mobile (#99)
  const visibleDays = (() => {
    if (span === "day" || allDays.length === 1) return allDays;
    const colCount = windowWidth < 480 ? 1 : windowWidth < 768 ? 3 : 7;
    if (colCount >= 7) return allDays;
    // Centre the visible window on the active day (dayStr or today)
    const anchor = dayStr ?? todayStr;
    const anchorIdx = allDays.indexOf(anchor);
    const centre = anchorIdx >= 0 ? anchorIdx : 0;
    const half = Math.floor(colCount / 2);
    const start = Math.max(0, Math.min(centre - half, allDays.length - colCount));
    return allDays.slice(start, start + colCount);
  })();

  const days = visibleDays;

  type DragData =
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{
    column: string;
    timeMin: number;
  } | null>(null);
  const [editingInstance, setEditingInstance] =
    useState<ClientTimetableInstance | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasPanel = !!availableTasks;

  let initialScrollMin = openTimeMin;
  for (const inst of instances) {
    if (inst.startTimeMin < initialScrollMin)
      initialScrollMin = inst.startTimeMin;
  }

  function handleDrop(col: string, timeMin: number, data: DragData) {
    startT(async () => {
      if (data.type === "task") {
        await createTimetableEntryAction(orgId, data.taskId, col, timeMin);
      } else {
        await updateTimetableEntryAction(orgId, data.instanceId, {
          startTimeMin: timeMin,
          dateStr: col,
        });
      }
      router.refresh();
    });
  }

  function handleTapPlace(col: string, timeMin: number, taskId: string) {
    startT(async () => {
      await createTimetableEntryAction(orgId, taskId, col, timeMin);
      setSelectedTaskId(null);
      setTaskPanelOpen(false);
      router.refresh();
    });
  }

  const isMobile = useIsMobile();
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const update = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setWindowWidth(window.innerWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <>
      <div
        className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}${isDropPending ? " opacity-50 pointer-events-none" : ""} transition-opacity duration-150`}
      >
        <div
          className={`relative${fillHeight ? " flex-1 min-h-0 flex flex-col" : " flex-1"}`}
        >
          {instances.length === 0 && !isDragging && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 rounded-xl">
              <div className="flex flex-col items-center gap-3 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-2xl font-semibold text-foreground">
                  {span === "day" ? "No tasks today" : "No tasks this week"}
                </p>
                {hasPanel && (
                  isMobile ? (
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
                  )
                )}
              </div>
            </div>
          )}
          <TimeGrid
            columns={days}
            instances={instances}
            getColumnKey={(inst) => inst.date}
            renderColumnHeader={(dayStr) => {
              const d = new Date(dayStr + "T00:00:00Z");
              const today = dayStr === todayStr;
              return (
                <>
                  <div
                    className={`text-[10px] font-semibold tracking-widest uppercase ${
                      today ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {getDayName(dayStr)}
                  </div>
                  <div className="flex justify-center mt-1.5">
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold leading-none transition-colors ${
                        today
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {d.getUTCDate()}
                    </div>
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
                  <Link
                    href={`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold truncate block hover:underline"
                  >
                    {inst.task.title}
                  </Link>
                  {heightPx >= 44 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(effStatus(inst))}`}
                      />
                      <span className="truncate text-[10px] text-muted-foreground">
                        {STATUS_LABELS[effStatus(inst)]}
                      </span>
                    </div>
                  )}
                  {heightPx >= 60 && assigneeNames && (
                    <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {assigneeNames}
                    </div>
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
            onBlockClick={(inst) =>
              router.push(`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`)
            }
            draggable={hasPanel}
            initialScrollMin={initialScrollMin}
            fillHeight={fillHeight}
            columnHighlightClass={(dayStr) =>
              dayStr === todayStr
                ? "bg-primary/[0.04] text-foreground"
                : undefined
            }
            blockColor={(inst) => inst.taskColor ?? undefined}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            selectedTaskId={isMobile ? selectedTaskId : null}
            onTapPlace={isMobile ? handleTapPlace : undefined}
          />
        </div>
        {hasPanel && !isMobile && (
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

      {/* Mobile: floating Tasks button + Sheet */}
      {hasPanel && isMobile && (
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
                  : "h-[80dvh] p-0 flex flex-col"
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
  span?: "day" | "week";
  dayStr?: string;
}

function SimpleView({
  instances,
  weekStart,
  todayStr,
  canManage,
  memberships,
  orgId,
  span = "week",
  dayStr,
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
    span === "day" && dayStr
      ? [dayStr]
      : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDate = groupBy(instances, (inst) => inst.date);

  if (instances.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-card py-24">
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
                          .map((a) => a.membership.user.name ?? "Unknown")
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
  span?: "day" | "week";
  dayStr?: string;
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
  span = "week",
  dayStr,
}: TimetableClientProps) {
  const effectiveDayStr = dayStr ?? todayStr;
  const router = useRouter();
  const [isNavPending, startNavTransition] = useTransition();
  const navigate = (href: string) =>
    startNavTransition(() => router.push(href));

  const makeHref = (
    w: string,
    m: string,
    s: "day" | "week" = span,
    d?: string,
  ) => {
    const p = new URLSearchParams({ week: w, mode: m, span: s });
    if (d) p.set("day", d);
    if (roleId) p.set("roleId", roleId);
    return `/orgs/${orgId}/timetable?${p.toString()}`;
  };

  let prevHref: string;
  let nextHref: string;
  let navLabel: string;

  if (span === "day") {
    const prevDay = addDays(effectiveDayStr, -1);
    const nextDay = addDays(effectiveDayStr, 1);
    prevHref = makeHref(prevDay, mode, "day", prevDay);
    nextHref = makeHref(nextDay, mode, "day", nextDay);
    const d = new Date(effectiveDayStr + "T00:00:00Z");
    navLabel = `${getDayName(effectiveDayStr)}, ${getMonthName(d.getUTCMonth())} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  } else {
    prevHref = makeHref(addDays(weekStart, -7), mode);
    nextHref = makeHref(addDays(weekStart, 7), mode);
    navLabel = formatWeekRange(weekStart);
  }

  const todayHref =
    span === "day"
      ? makeHref(todayStr, mode, "day", todayStr)
      : makeHref(todayStr, mode, "week");

  const isOnToday =
    span === "day"
      ? effectiveDayStr === todayStr
      : todayStr >= weekStart && todayStr < addDays(weekStart, 7);

  return (
    <div
      className={`flex flex-col gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}
    >
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs shrink-0 transition-opacity duration-200${isOnToday ? " opacity-0 pointer-events-none" : ""}`}
          onClick={() => navigate(todayHref)}
          disabled={isNavPending || isOnToday}
        >
          Today
        </Button>
        <div
          className={`h-4 w-px bg-border shrink-0 transition-opacity duration-200${isOnToday ? " opacity-0" : ""}`}
        />
        <div className="flex items-center gap-0.5 flex-1 justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate(prevHref)}
            disabled={isNavPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span
            className={`text-sm font-medium min-w-52 text-center transition-opacity duration-150${isNavPending ? " opacity-50" : ""}`}
          >
            {navLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate(nextHref)}
            disabled={isNavPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={`transition-opacity duration-150${isNavPending ? " opacity-40 pointer-events-none" : ""}${fillHeight ? " flex-1 min-h-0 flex flex-col" : ""}`}
      >
        {mode === "calendar" ? (
          <CalendarView
            instances={instances}
            weekStart={weekStart}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            fillHeight={fillHeight}
            orgId={orgId}
            todayStr={todayStr}
            canManage={canManage}
            availableTasks={availableTasks}
            memberships={memberships}
            span={span}
            dayStr={effectiveDayStr}
          />
        ) : (
          <SimpleView
            instances={instances}
            weekStart={weekStart}
            todayStr={todayStr}
            canManage={canManage}
            memberships={memberships}
            orgId={orgId}
            span={span}
            dayStr={effectiveDayStr}
          />
        )}
      </div>
    </div>
  );
}