"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, LayoutList, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createTimetableEntryAction,
  updateTimetableEntryAction,
} from "@/app/actions/timetable-entries";
import { TimeGrid } from "../_shared/time-grid";
import { TaskPanel } from "../_shared/task-panel";
import { addDays, getDayName, minToHHMM } from "../_shared/grid-utils";
import { STATUS_LABELS, statusDotClass, getMondayOf } from "./helpers";
import { CalendarEditPopup } from "./calendar-edit-popup";
import type {
  ClientTimetableInstance,
  ClientMembership,
  ClientTask,
} from "./types";

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export interface CalendarViewProps {
  instances: ClientTimetableInstance[];
  /** Centre of the 13-day window — anchor±6 days are always loaded. */
  anchor: string;
  /** "day" forces single-column; "week" uses automatic ResizeObserver. */
  span?: "day" | "week";
  openTimeMin: number;
  closeTimeMin?: number;
  fillHeight?: boolean;
  orgId: string;
  todayStr: string;
  canManage: boolean;
  availableTasks?: ClientTask[];
  memberships?: ClientMembership[];
  /** Called whenever the visible column count changes. */
  onVisibleRangeChange?: (
    count: number,
    visStart: string,
    visEnd: string,
  ) => void;
}

export function CalendarView({
  instances,
  anchor,
  span = "week",
  openTimeMin,
  closeTimeMin,
  fillHeight,
  orgId,
  todayStr,
  canManage,
  availableTasks,
  memberships,
  onVisibleRangeChange,
}: CalendarViewProps) {
  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr
      ? "SKIPPED"
      : inst.status;
  }
  const router = useRouter();
  const [isDropPending, startT] = useTransition();

  // Track the actual calendar container width via ResizeObserver so that
  // zoom level, sidebar state, and task panel are all accounted for.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // 13-day window centred on anchor (indices 0–12, anchor at index 6).
  // The extra width (vs. 9 days) ensures the full Mon–Sun week is always
  // loaded regardless of which weekday the anchor falls on.
  const allDays = Array.from({ length: 13 }, (_, i) => addDays(anchor, i - 6));

  // Adaptive column count: fit as many days as possible given the container.
  // Time gutter = w-14 (56px), each column needs at least 90px to be readable.
  // Forced to an odd number (1, 3, 5, 7) so there is always a clear centre column.
  // Day span overrides everything and forces a single column.
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

  const visibleDays = (() => {
    if (colCount >= 7) {
      // Week mode: always show Mon–Sun of the anchor's week.
      const weekMon = getMondayOf(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(weekMon, i));
    }
    // Sub-week mode: slice colCount days centred on anchor (index 6).
    const half = Math.floor(colCount / 2);
    return allDays.slice(6 - half, 6 - half + colCount);
  })();

  const days = visibleDays;

  // Notify parent whenever the visible day range changes so it can update
  // navigation step size and label accordingly.
  // Always report the configured colCount (not days.length) so the nav step
  // size is stable even for the shorter last window of the week.
  const daysKey = days.join(",");
  useEffect(() => {
    if (days.length > 0) {
      onVisibleRangeChange?.(colCount, days[0], days[days.length - 1]);
    }
  }, [daysKey, colCount]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const visibleSet = new Set(visibleDays);
  for (const inst of instances) {
    if (
      visibleSet.has(inst.date) &&
      inst.startTimeMin < initialScrollMin
    ) {
      initialScrollMin = inst.startTimeMin;
    }
  }

  function handleDrop(col: string, timeMin: number, data: DragData) {
    startT(async () => {
      let result;
      if (data.type === "task") {
        result = await createTimetableEntryAction(orgId, data.taskId, col, timeMin);
      } else {
        result = await updateTimetableEntryAction(orgId, data.instanceId, {
          startTimeMin: timeMin,
          dateStr: col,
        });
      }
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    });
  }

  function handleTapPlace(col: string, timeMin: number, taskId: string) {
    startT(async () => {
      const result = await createTimetableEntryAction(orgId, taskId, col, timeMin);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      setSelectedTaskId(null);
      setTaskPanelOpen(false);
      router.refresh();
    });
  }

  const isMobile = useIsMobile();
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div
        className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}${isDropPending ? " opacity-50 pointer-events-none" : ""} transition-opacity duration-150`}
      >
        <div
          ref={containerRef}
          className={`relative${fillHeight ? " flex-1 min-h-0 flex flex-col" : " flex-1"}`}
        >
          {(() => {
            // Check only the currently visible days — instances outside the
            // window are fetched but shouldn't affect the empty-state overlay.
            const visibleSet = new Set(visibleDays);
            const hasVisibleInstances = instances.some((inst) =>
              visibleSet.has(inst.date),
            );
            const emptyLabel =
              colCount === 1
                ? "No tasks today"
                : colCount >= 7
                  ? "No tasks this week"
                  : "No tasks in this range";
            return (
              !hasVisibleInstances &&
              !isDragging &&
              !selectedTaskId && (
                <div className="absolute inset-0 z-20 flex items-center justify-center border bg-background/90">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-2xl font-semibold text-foreground">
                      {emptyLabel}
                    </p>
                    {hasPanel &&
                      (isMobile ? (
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
                      ))}
                  </div>
                </div>
              )
            );
          })()}
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