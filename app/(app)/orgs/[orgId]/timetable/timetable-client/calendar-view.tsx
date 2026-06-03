"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, ChevronRight, GripVertical, Layers } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import {
  createTimetableEntryAction,
  updateTimetableEntryAction,
  updateTimetableEntriesBatchAction,
  fetchTimetableInstancesAction,
} from "@/app/actions/timetable-entries";
import { TimeGrid } from "../_shared/time-grid";
import { addDays, getDayName, minToHHMM } from "../_shared/grid-utils";
import { useTimetableZoom } from "../_shared/timetable-zoom-context";
import { STATUS_LABELS, statusDotClass, getMondayOf } from "./helpers";
import { CalendarEditSidebarContent } from "./calendar-edit-sidebar-content";
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
  /** Current user's ID — used to scope the past-drop warning suppression per user. */
  userId?: string;
  /** Controlled: which task is selected for tap-to-place (managed by TimetableClient). */
  selectedTaskId?: string | null;
  /** Called when the grid wants to clear the selected task (after successful tap-place). */
  onSelectedTaskIdChange?: (id: string | null) => void;
  /** Called when the empty-state "Add task" button is tapped (opens task panel Sheet). */
  onOpenTaskPanel?: () => void;
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
  userId,
  selectedTaskId = null,
  onSelectedTaskIdChange,
  onOpenTaskPanel,
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
    | { type: "move"; instanceId: string; offsetMin: number }
    | {
        type: "group";
        instanceIds: string[];
        instances?: ClientTimetableInstance[];
        groupStartMin: number;
        offsetMin: number;
      };
  const dragDataRef = useRef<DragData | null>(null);
  const [dragOver, setDragOver] = useState<{
    column: string;
    timeMin: number;
  } | null>(null);
  const { open: openSidebar, close: closeSidebar } = useActionSidebar();
  const { hourHeight } = useTimetableZoom();

  // Consistent color helpers: prefer the instance's `taskColor` computed
  // server-side; fall back to a sensible grey for UI elements that need
  // a concrete color value.
  const getTaskColor = (inst: ClientTimetableInstance) => inst.taskColor ?? "#9ca3af";
  const getTaskColorMaybe = (inst: ClientTimetableInstance) => inst.taskColor ?? undefined;

  function openEditSidebar(
    inst: ClientTimetableInstance,
    onBack?: () => void,
  ) {
    openSidebar(
      inst.task.title,
      <CalendarEditSidebarContent
        key={inst.id}
        instance={inst}
        memberships={memberships ?? []}
        orgId={orgId}
        canManage={canManage}
        onClose={closeSidebar}
        onRefresh={() => router.refresh()}
        router={router}
        todayStr={todayStr}
        onBack={onBack}
      />,
    );
  }

    function GroupSidebar({ ids }: { ids: string[] }) {
      const [loading, setLoading] = useState(true);
      const [currentGroup, setCurrentGroup] = useState<ClientTimetableInstance[]>([]);

      const idsKey = ids.join(",");
      useEffect(() => {
        let mounted = true;
        (async () => {
          const res = await fetchTimetableInstancesAction(orgId, ids);
          if (!mounted) return;
          if (!res.ok) {
            toast.error(res.error ?? "Failed to load group");
            setCurrentGroup([]);
            setLoading(false);
            return;
          }
          // cast the returned shape to the client instance shape
          const fetched = (res.data ?? []) as unknown as ClientTimetableInstance[];
          // Reorder fetched instances to match the requested `ids` order so the
          // ActionSidebar displays rows in the same order as the calendar's
          // group block. The server may return instances in arbitrary order,
          // so map them by id and then rebuild the array using `ids`.
          const byId = new Map<string, ClientTimetableInstance>(
            fetched.map((i) => [i.id, i]),
          );
          const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as ClientTimetableInstance[];
          setCurrentGroup(ordered);
          setLoading(false);
        })();
        return () => {
          mounted = false;
        };
      }, [idsKey, ids]);

      if (loading)
        return (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card px-3 py-2.5 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-2/3 mb-1" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      return (
        <div className="flex flex-col gap-2 p-3">
            {currentGroup.map((inst) => {
            const assigneeNames = inst.assignees
              .map(
                (a) =>
                  a.membership.user?.name ??
                  a.membership.botName ??
                  "Bot",
              )
              .join(", ");
            const dotClass = statusDotClass(
              inst.status === "TODO" && inst.date < todayStr
                ? "SKIPPED"
                : inst.status,
            );
            // Determine a display color for the instance stripe. Prefer the
            // first assignee's first role color (if available from the
            // `memberships` prop), otherwise fall back to the instance's
            // `taskColor` (which may itself be role-derived) and finally
            // to a sensible default.
            return (
              <div
                key={inst.id}
                draggable={canManage}
                onDragStart={(e) => {
                  dragDataRef.current = {
                    type: "move",
                    instanceId: inst.id,
                    offsetMin: 0,
                  };
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={closeSidebar}
                className={`flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors ${canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                onClick={() => openEditSidebar(inst, () => openGroupSidebar(ids))}
              >
                {canManage && (
                  <GripVertical className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/40" />
                )}
                <span
                  className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: getTaskColor(inst) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate block">
                    {inst.task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {minToHHMM(inst.startTimeMin)}&ndash;
                      {minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                    <span className="text-[10px] text-muted-foreground">
                      {STATUS_LABELS[
                        inst.status === "TODO" && inst.date < todayStr
                          ? "SKIPPED"
                          : inst.status
                      ]}
                    </span>
                  </div>
                  {assigneeNames && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {assigneeNames}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

  function openGroupSidebar(groupInstancesOrIds: ClientTimetableInstance[] | string[]) {
    const ids =
      typeof groupInstancesOrIds[0] === "string"
        ? (groupInstancesOrIds as string[])
        : (groupInstancesOrIds as ClientTimetableInstance[]).map((i) => i.id);
    // Compute a best-effort title using currently loaded instances (may be stale)
    const currentGroup = ids
      .map((id) => instances.find((i) => i.id === id))
      .filter(Boolean) as ClientTimetableInstance[];

    const groupStart = currentGroup.length ? Math.min(...currentGroup.map((i) => i.startTimeMin)) : 0;
    const groupEnd = currentGroup.length ? Math.max(...currentGroup.map((i) => i.startTimeMin + i.task.durationMin)) : 0;

    openSidebar(
      `${ids.length} overlapping${currentGroup.length ? ` · ${minToHHMM(groupStart)}–${minToHHMM(groupEnd)}` : ""}`,
      <GroupSidebar ids={ids} />,
    );
  }

  type PendingDrop =
    | { kind: "drop"; col: string; timeMin: number; data: DragData }
    | { kind: "tap"; col: string; timeMin: number; taskId: string };
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [suppressDrop, setSuppressDrop] = useState(false);

  const DROP_SUPPRESS_KEY = userId
    ? `timetable-past-drop-warn-suppress:${userId}`
    : "timetable-past-drop-warn-suppress";

  function isDropSuppressed(): boolean {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(DROP_SUPPRESS_KEY);
    if (!stored) return false;
    return Date.now() < Number(stored);
  }

  const hasPanel = !!availableTasks;

  let initialScrollMin = openTimeMin;
  const visibleSet = new Set(visibleDays);
  for (const inst of instances) {
    if (visibleSet.has(inst.date) && inst.startTimeMin < initialScrollMin) {
      initialScrollMin = inst.startTimeMin;
    }
  }

  function executeDrop(col: string, timeMin: number, data: DragData) {
    // Execute a resolved drop action.
    // `data` can be:
    // - { type: 'task', taskId } -> create a new entry at `timeMin`
    // - { type: 'move', instanceId } -> move a single instance to `col`/`timeMin`
    // - { type: 'group', instanceIds, instances?, groupStartMin } -> move a whole
    //   overlapping group by the computed delta. When available, prefer
    //   `data.instances` (full instance objects) to avoid repeated `.find()` on
    //   the `instances` array.
    startT(async () => {
      if (data.type === "task") {
        const result = await createTimetableEntryAction(
          orgId,
          data.taskId,
          col,
          timeMin,
        );
        if (!result.ok) { toast.error(result.error ?? "Something went wrong"); return; }
      } else if (data.type === "group") {
        const delta = timeMin - data.groupStartMin;
        const insts = data.instances ?? data.instanceIds.map((id) => instances.find((i) => i.id === id)).filter(Boolean) as ClientTimetableInstance[];
        const updates = insts.map((inst) => ({ entryId: inst.id, startTimeMin: Math.max(0, inst.startTimeMin + delta), dateStr: col }));
        const result = await updateTimetableEntriesBatchAction(orgId, updates);
        if (!result.ok) { toast.error(result.error ?? "Something went wrong"); return; }
      } else {
        const result = await updateTimetableEntryAction(orgId, data.instanceId, {
          startTimeMin: timeMin,
          dateStr: col,
        });
        if (!result.ok) { toast.error(result.error ?? "Something went wrong"); return; }
      }
      router.refresh();
    });
  }

  // Handle a drop with past-date protection. If the target column is in the
  // past and the user hasn't suppressed warnings, show a confirmation dialog
  // via `pendingDrop`; otherwise forward to `executeDrop`.
  function handleDrop(col: string, timeMin: number, data: DragData) {
    if (col < todayStr && !isDropSuppressed()) {
      setPendingDrop({ kind: "drop", col, timeMin, data });
      return;
    }
    executeDrop(col, timeMin, data);
  }

  // Place a new task at a specific column/time (used for tap-to-place on mobile).
  // Resets the selectedTaskId (via `onSelectedTaskIdChange`) on success and
  // triggers a `router.refresh()` to sync the client with the mutation.
  function executeTap(col: string, timeMin: number, taskId: string) {
    startT(async () => {
      const result = await createTimetableEntryAction(
        orgId,
        taskId,
        col,
        timeMin,
      );
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      onSelectedTaskIdChange?.(null);
      router.refresh();
    });
  }

  function handleTapPlace(col: string, timeMin: number, taskId: string) {
    if (col < todayStr && !isDropSuppressed()) {
      setPendingDrop({ kind: "tap", col, timeMin, taskId });
      return;
    }
    executeTap(col, timeMin, taskId);
  }

  const isMobile = useIsMobile();
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
              !dragOver &&
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
                          onClick={() => onOpenTaskPanel?.()}
                          className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-md px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform"
                        >
                          <Plus className="h-4 w-4" />
                          Add task
                        </button>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Use &ldquo;Add Task&rdquo; in the sidebar to get
                          started
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
            renderBlock={(inst, _heightPx) => {
              const assigneeNames = inst.assignees
                .map(
                  (a) =>
                    (
                      a.membership.user?.name ??
                      a.membership.botName ??
                      "Bot"
                    ).split(" ")[0],
                )
                .join(", ");
              return (
                <>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(effStatus(inst))}`}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground/80 leading-none tabular-nums">
                      {minToHHMM(inst.startTimeMin)}–{minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                    </span>
                  </div>
                  <span className="font-semibold truncate block leading-tight">
                    {inst.task.title}
                  </span>
                  {assigneeNames && (
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
            onBlockMenuClick={memberships ? (inst) => router.push(`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`) : undefined}
            onBlockClick={openEditSidebar}
            draggable={canManage}
            initialScrollMin={initialScrollMin}
            fillHeight={fillHeight}
            hourHeight={hourHeight}
            columnHighlightClass={(dayStr) =>
              dayStr === todayStr
                ? "bg-primary/[0.04] text-foreground"
                : undefined
            }
            blockColor={(inst) => getTaskColorMaybe(inst)}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            selectedTaskId={isMobile ? selectedTaskId : null}
            onTapPlace={isMobile ? handleTapPlace : undefined}
            onGroupClick={(groupInstances) => {
              openGroupSidebar(groupInstances);
            }}
            renderGroupBlock={(instances, groupStart, groupEnd, heightPx) => {
              const counts = instances.reduce(
                (acc, inst) => {
                  acc[inst.status] = (acc[inst.status] ?? 0) + 1;
                  return acc;
                },
                { TODO: 0, IN_PROGRESS: 0, SKIPPED: 0, DONE: 0 } as Record<
                  ClientTimetableInstance["status"],
                  number
                >,
              );

              return (
                <>
                  {/* Header: time range + stacked count badge */}
                  <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                    <span className="text-[9px] font-mono text-muted-foreground/70 leading-none tabular-nums">
                      {minToHHMM(groupStart)}–{minToHHMM(groupEnd)}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-300 leading-none">
                      <Layers className="h-2.5 w-2.5" />
                      {instances.length}
                    </span>
                  </div>

                  {/* Status summary: small dot + count for each status (below header) */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {counts.TODO > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${statusDotClass("TODO")}`} />
                        <span className="text-xs font-medium tabular-nums">{counts.TODO}</span>
                      </div>
                    )}
                    {counts.IN_PROGRESS > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${statusDotClass("IN_PROGRESS")}`} />
                        <span className="text-xs font-medium tabular-nums">{counts.IN_PROGRESS}</span>
                      </div>
                    )}
                    {counts.SKIPPED > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${statusDotClass("SKIPPED")}`} />
                        <span className="text-xs font-medium tabular-nums">{counts.SKIPPED}</span>
                      </div>
                    )}
                    {counts.DONE > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${statusDotClass("DONE")}`} />
                        <span className="text-xs font-medium tabular-nums">{counts.DONE}</span>
                      </div>
                    )}
                  </div>

                  {/* Per-task rows */}
                  {(() => {
                    const MAX_VISIBLE = 5;
                    const ROW_PX = 36; // estimated per-row height
                    const HEADER_PAD = 36; // estimated header + padding
                    if (instances.length <= MAX_VISIBLE) {
                      return (
                        <div className="flex flex-col gap-1 overflow-hidden">
                          {instances.map((inst) => {
                            const effectiveStatus =
                              inst.status === "TODO" && inst.date < todayStr
                                ? "SKIPPED"
                                : inst.status;
                            const assigneeNames = inst.assignees
                              .map((a) =>
                                (
                                  a.membership.user?.name ??
                                  a.membership.botName ??
                                  "Bot"
                                ).split(" ")[0],
                              )
                              .join(", ");
                            return (
                              <div key={inst.id} className="flex items-start gap-1 min-w-0">
                                {/* Task color identity stripe */}
                                <span
                                  className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                                  style={{ backgroundColor: getTaskColor(inst) }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 min-w-0">
                                    {/* Status dot */}
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(effectiveStatus)}`}
                                    />
                                    <span className="text-[10px] font-semibold truncate leading-tight">
                                      {inst.task.title}
                                    </span>
                                  </div>
                                  {assigneeNames && (
                                    <span className="text-[9px] text-muted-foreground/70 truncate leading-tight block pl-2.5">
                                      {assigneeNames}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // instances.length > MAX_VISIBLE -> compute a maxHeight
                    const contentSpace = Math.max(0, heightPx - HEADER_PAD);
                    const fiveRowsPx = ROW_PX * MAX_VISIBLE;
                    // If the block is already tall enough to show >= 5 rows, use the
                    // block's content space before scrolling; otherwise cap at 5 rows.
                    const maxContentHeight = contentSpace >= fiveRowsPx ? contentSpace : fiveRowsPx;

                    return (
                      <div style={{ maxHeight: `${maxContentHeight}px`, overflowY: "auto" }} className="flex flex-col gap-1">
                        {instances.map((inst) => {
                          const effectiveStatus =
                            inst.status === "TODO" && inst.date < todayStr
                              ? "SKIPPED"
                              : inst.status;
                          const assigneeNames = inst.assignees
                            .map((a) =>
                              (
                                a.membership.user?.name ??
                                a.membership.botName ??
                                "Bot"
                              ).split(" ")[0],
                            )
                            .join(", ");
                          return (
                            <div key={inst.id} className="flex items-start gap-1 min-w-0">
                              <span
                                className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
                                style={{ backgroundColor: getTaskColor(inst) }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(effectiveStatus)}`}
                                  />
                                  <span className="text-[10px] font-semibold truncate leading-tight">
                                    {inst.task.title}
                                  </span>
                                </div>
                                {assigneeNames && (
                                  <span className="text-[9px] text-muted-foreground/70 truncate leading-tight block pl-2.5">
                                    {assigneeNames}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <ChevronRight className="absolute bottom-1 right-1 h-3 w-3 text-muted-foreground/40" />
                </>
              );
            }}
          />
        </div>
      </div>

      <AlertDialog
        open={!!pendingDrop}
        onOpenChange={(open) => {
          if (!open) setPendingDrop(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop on a past date?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDrop && (
                <>
                  <strong>{pendingDrop.col}</strong> is in the past. Are you
                  sure you want to place a task here?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-1 pb-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary rounded"
              checked={suppressDrop}
              onChange={(e) => setSuppressDrop(e.target.checked)}
            />
            Don&apos;t warn me again for 24 hours
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDrop(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDrop) return;
                if (suppressDrop) {
                  localStorage.setItem(
                    DROP_SUPPRESS_KEY,
                    String(Date.now() + 24 * 60 * 60 * 1000),
                  );
                }
                const p = pendingDrop;
                setPendingDrop(null);
                setSuppressDrop(false);
                if (p.kind === "drop") {
                  executeDrop(p.col, p.timeMin, p.data);
                } else {
                  executeTap(p.col, p.timeMin, p.taskId);
                }
              }}
            >
              Place Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
