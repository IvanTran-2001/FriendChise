"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, ChevronRight, GripVertical, Layers, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistedState } from "@/hooks/use-persisted-state";
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
  taskColors: Record<
    string,
    { color: string | null; roleColor: string | null; tagColor: string | null }
  >;
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
  /** Optional external dragging state controlled by parent. */
  isDraggingExternal?: boolean;
}

function GroupSidebarComponent({
  ids,
  orgId,
  memberships,
  canManage,
  dragDataRef,
  getTaskColor,
  openEditForInst,
  todayStr,
  initialInstances,
}: {
  ids: string[];
  orgId: string;
  memberships?: ClientMembership[] | undefined;
  canManage: boolean;
  dragDataRef: React.RefObject<
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number }
    | {
        type: "group";
        instanceIds: string[];
        instances?: ClientTimetableInstance[];
        groupStartMin: number;
        offsetMin: number;
      }
    | null
  >;
  getTaskColor: (inst: ClientTimetableInstance) => string;
  openEditForInst: (inst: ClientTimetableInstance) => void;
  todayStr: string;
  /** Optional server-provided instances to avoid refetching */
  initialInstances?: ClientTimetableInstance[];
}) {
  const [loading, setLoading] = useState(initialInstances ? false : true);
  const [currentGroup, setCurrentGroup] = useState<ClientTimetableInstance[]>(initialInstances ?? []);
  const router = useRouter();

  const idsKey = ids.join(",");
  useEffect(() => {
    if (initialInstances) return; // server provided data — skip fetch
    let mounted = true;
    (async () => {
      try {
        const res = await fetchTimetableInstancesAction(orgId, ids);
        if (!mounted) return;
        if (!res.ok) {
          toast.error(res.error ?? "Failed to load group");
          setCurrentGroup([]);
          return;
        }
        const fetched = (res.data ?? []) as unknown as ClientTimetableInstance[];
        const byId = new Map<string, ClientTimetableInstance>(
          fetched.map((i) => [i.id, i]),
        );
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((i): i is ClientTimetableInstance => i !== undefined && i !== null);
        setCurrentGroup(ordered);
      } catch (error) {
        if (!mounted) return;
        toast.error(error instanceof Error ? error.message : "Failed to load group");
        setCurrentGroup([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [idsKey, ids, orgId, initialInstances]);

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
              <div className="flex items-center gap-2.5">
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
          .map((a) => a.membership.user?.name ?? a.membership.botName ?? "Bot")
          .join(", ");
        const dotClass = statusDotClass(inst.status === "TODO" && inst.date < todayStr ? "SKIPPED" : inst.status);
        return (
          <div
            key={inst.id}
            draggable={canManage}
            onDragStart={(e) => {
              dragDataRef.current = { type: "move", instanceId: inst.id, offsetMin: 0 };
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              dragDataRef.current = null;
            }}
            className={`flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors ${
              canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            }`}
            onClick={() => openEditForInst(inst)}
          >
            {canManage && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
            <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: getTaskColor(inst) }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate block">{inst.task.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {minToHHMM(inst.startTimeMin)}&ndash;{minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                <span className="text-[10px] text-muted-foreground">
                  {STATUS_LABELS[inst.status === "TODO" && inst.date < todayStr ? "SKIPPED" : inst.status]}
                </span>
              </div>
              {assigneeNames && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{assigneeNames}</div>}
            </div>
            {memberships && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/orgs/${orgId}/tasks/${inst.taskId}?ref=timetable`);
                }}
                aria-label="Open task"
                className="h-6 w-6 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground/90"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
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
  taskColors,
  memberships,
  onVisibleRangeChange,
  userId,
  selectedTaskId = null,
  onSelectedTaskIdChange,
  onOpenTaskPanel,
  isDraggingExternal,
}: CalendarViewProps) {
  function effStatus(inst: ClientTimetableInstance) {
    return inst.status === "TODO" && inst.date < todayStr
      ? "SKIPPED"
      : inst.status;
  }
  const router = useRouter();
  const [isDropPending, startT] = useTransition();

  // Dragging state is controlled externally via `isDraggingExternal`.
  const effectiveIsDragging = typeof isDraggingExternal === "boolean" ? isDraggingExternal : false;

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
  const { open: openSidebar, close: closeSidebar, activeTitle } = useActionSidebar();
  // Track the slot (date + time range) of the currently open group sidebar.
  // We store the slot (not the original instance ids) so that when the
  // `instances` prop updates we can re-derive membership by overlap. This
  // ensures items moved out of the slot are excluded and items moved into
  // the slot are included automatically.
  const openGroupSlotRef = useRef<{ date: string; startMin: number; endMin: number } | null>(null);
  const lastGroupTitleRef = useRef<string | null>(null);
  const lastEditTitleRef = useRef<string | null>(null);
  const lastEditDateRef = useRef<string | null>(null);
  const { hourHeight } = useTimetableZoom();

  // Clear the stored open group slot if the sidebar is closed or a different
  // panel is active. This prevents accidental re-opening on `instances`
  // refresh when the user has dismissed or replaced the group panel.
  useEffect(() => {
    if (!activeTitle) {
      openGroupSlotRef.current = null;
      lastGroupTitleRef.current = null;
      lastEditTitleRef.current = null;
      lastEditDateRef.current = null;
      return;
    }
    if (lastGroupTitleRef.current && activeTitle !== lastGroupTitleRef.current) {
      openGroupSlotRef.current = null;
      lastGroupTitleRef.current = null;
    }
    if (lastEditTitleRef.current && activeTitle !== lastEditTitleRef.current) {
      lastEditTitleRef.current = null;
      lastEditDateRef.current = null;
    }
  }, [activeTitle]);

  const [colorFilter] = usePersistedState<"task" | "role" | "tag">(
    "friendchise-color-filter",
    "task",
  );

  // Consistent color helpers: dynamic lookup based on selected colorFilter
  const getTaskColor = useCallback((inst: ClientTimetableInstance) => {
    const entry = taskColors[inst.taskId];
    let color: string | null = null;
    if (colorFilter === "role") {
      color = entry?.roleColor ?? null;
    } else if (colorFilter === "tag") {
      color = entry?.tagColor ?? null;
    } else if (colorFilter === "task") {
      color = entry?.color ?? null;
    }
    return color ?? inst.taskColor ?? "#9ca3af";
  }, [colorFilter, taskColors]);

  const getTaskColorMaybe = useCallback((inst: ClientTimetableInstance) => {
    const entry = taskColors[inst.taskId];
    let color: string | null = null;
    if (colorFilter === "role") {
      color = entry?.roleColor ?? null;
    } else if (colorFilter === "tag") {
      color = entry?.tagColor ?? null;
    } else if (colorFilter === "task") {
      color = entry?.color ?? null;
    }
    return color ?? inst.taskColor ?? undefined;
  }, [colorFilter, taskColors]);

  function openEditSidebar(
    inst: ClientTimetableInstance,
    onBack?: () => void,
  ) {
    openSidebar(
      inst.task.title,
      <CalendarEditSidebarContent
        key={inst.id}
        instance={inst}
        taskColor={getTaskColor(inst)}
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

  function openGroupSidebar(groupInstancesOrIds: ClientTimetableInstance[] | string[]) {
    const groupInsts: ClientTimetableInstance[] =
      typeof groupInstancesOrIds[0] === "string"
        ? (groupInstancesOrIds as string[])
            .map((id) => instances.find((i) => i.id === id))
            .filter((i): i is ClientTimetableInstance => i !== undefined)
        : (groupInstancesOrIds as ClientTimetableInstance[]);

    if (groupInsts.length === 0) return;

    const groupStart = Math.min(...groupInsts.map((i) => i.startTimeMin));
    const groupEnd = Math.max(...groupInsts.map((i) => i.startTimeMin + i.task.durationMin));
    const ids = groupInsts.map((i) => i.id);

    // Store the canonical slot for this opened group. This tells the effect
    // which date and time-range to re-evaluate against the fresh `instances`
    // whenever `CalendarView` receives updated data (via `router.refresh()`).
    // We intentionally store the slot instead of ids so the group reflects
    // the current contents of that timeslot rather than the original snapshot.
    openGroupSlotRef.current = { date: groupInsts[0].date, startMin: groupStart, endMin: groupEnd };
      const title = `${ids.length} overlapping · ${minToHHMM(groupStart)}–${minToHHMM(groupEnd)}`;
      lastGroupTitleRef.current = title;
      openSidebar(
        title,
        <GroupSidebarComponent
          ids={ids}
          initialInstances={groupInsts}
          orgId={orgId}
          memberships={memberships}
          canManage={canManage}
          dragDataRef={dragDataRef}
          getTaskColor={getTaskColor}
          openEditForInst={(inst: ClientTimetableInstance) =>
            openEditSidebar(inst)
          }
          todayStr={todayStr}
        />,
      );
  }

  // Re-open the group sidebar with fresh data whenever `instances` changes
  // (triggered by `router.refresh()` after mutations). The effect below:
  // 1) reads the saved slot from `openGroupSlotRef.current` (if any)
  // 2) re-derives the current members of that slot by checking overlap
  //    against the fresh `instances` prop
  // 3) calls `openSidebar(...)` with a new `key` to force remounting the
  //    `GroupSidebarComponent` so its own fetch runs and the UI updates.
  //
  // Using slot-overlap (date + time range) rather than stored ids ensures:
  // - items moved out of the original group are not shown
  // - items moved into the same slot are included
  // - deleted items disappear

  useEffect(() => {
    const slot = openGroupSlotRef.current;
    if (!slot) return;

    const freshGroup = instances.filter(
      (i) =>
        i.date === slot.date &&
        i.startTimeMin < slot.endMin &&
        i.startTimeMin + i.task.durationMin > slot.startMin,
    );

    if (freshGroup.length === 0) {
      openGroupSlotRef.current = null;
      closeSidebar();
      return;
    }

    const freshIds = freshGroup.map((i) => i.id);
    const freshStart = Math.min(...freshGroup.map((i) => i.startTimeMin));
    const freshEnd = Math.max(...freshGroup.map((i) => i.startTimeMin + i.task.durationMin));

    const title = `${freshIds.length} overlapping · ${minToHHMM(freshStart)}–${minToHHMM(freshEnd)}`;
    lastGroupTitleRef.current = title;
    openSidebar(
      title,
      <GroupSidebarComponent
        key={freshGroup.map((i) => `${i.id}:${i.startTimeMin}:${i.date}`).join(",")}
        ids={freshIds}
        initialInstances={freshGroup}
        orgId={orgId}
        memberships={memberships}
        canManage={canManage}
        dragDataRef={dragDataRef}
        getTaskColor={getTaskColor}
        openEditForInst={(inst: ClientTimetableInstance) =>
          openEditSidebar(inst, () => openGroupSidebar(freshIds))
        }
        todayStr={todayStr}
      />,
    );
  }, [instances]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // If the server returned the created instance, open the ActionSidebar
        // immediately so the user can edit assignees/schedule. Also highlight
        // the target column while the panel is open.
        if (result.data) {
          const inst = result.data;
          const title = inst.task.title;
          lastEditTitleRef.current = title;
          lastEditDateRef.current = inst.date;
          openSidebar(
            title,
            <CalendarEditSidebarContent
              key={inst.id}
              instance={inst}
              memberships={memberships ?? []}
              orgId={orgId}
              canManage={canManage}
              onClose={() => {
                closeSidebar();
                lastEditDateRef.current = null;
              }}
              onRefresh={() => router.refresh()}
              router={router}
              todayStr={todayStr}
            />,
          );
        }
      } else if (data.type === "group") {
        let delta = timeMin - data.groupStartMin;
        const insts = data.instances ?? data.instanceIds.map((id) => instances.find((i) => i.id === id)).filter(Boolean) as ClientTimetableInstance[];
        // Compute allowed delta range to prevent any member from moving outside
        // the org's open/close hours (falls back to full-day bounds).
        const minAllowed = openTimeMin ?? 0;
        const maxAllowed = (closeTimeMin ?? 1440);
        const minDelta = Math.max(...insts.map(i => minAllowed - i.startTimeMin));
        const maxDelta = Math.min(...insts.map(i => maxAllowed - (i.startTimeMin + (i.task?.durationMin ?? 0))));
        const originalDelta = delta;
        delta = Math.max(minDelta, Math.min(delta, maxDelta));
        if (originalDelta !== delta) {
          toast("Drop was adjusted to prevent tasks moving outside allowed hours", { duration: 3000 });
        }
        const updates = insts.map((inst) => ({ entryId: inst.id, startTimeMin: inst.startTimeMin + delta, dateStr: col }));
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
    const minAllowed = openTimeMin ?? 0;
    const maxAllowed = (closeTimeMin ?? 1440) - 1;
    const clampedTime = Math.max(minAllowed, Math.min(maxAllowed, timeMin));
    executeDrop(col, clampedTime, data);
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
              !selectedTaskId &&
              !isDropPending &&
              !effectiveIsDragging && (
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
            columnHighlightClass={(dayStr) => {
              if (dayStr === todayStr) return "bg-primary/[0.04] text-foreground";
              if (lastEditDateRef.current && lastEditTitleRef.current && activeTitle === lastEditTitleRef.current && dayStr === lastEditDateRef.current) {
                return "bg-primary/10 ring-1 ring-primary/40 text-foreground";
              }
              return undefined;
            }}
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
                  const effectiveStatus = effStatus(inst);
                  acc[effectiveStatus] = (acc[effectiveStatus] ?? 0) + 1;
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

                  {/* Per-task rows (shared rendering, wrapper differs for scrolling) */}
                  {(() => {
                    const MAX_VISIBLE = 5;
                    const ROW_PX = 36; // estimated per-row height
                    const HEADER_PAD = 36; // estimated header + padding

                    const rows = instances.map((inst) => {
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
                    });

                    if (instances.length <= MAX_VISIBLE) {
                      return <div className="flex flex-col gap-1 overflow-hidden">{rows}</div>;
                    }

                    // instances.length > MAX_VISIBLE -> compute a maxHeight
                    const contentSpace = Math.max(0, heightPx - HEADER_PAD);
                    const fiveRowsPx = ROW_PX * MAX_VISIBLE;
                    // If the block is already tall enough to show >= 5 rows, use the
                    // block's content space before scrolling; otherwise cap at 5 rows.
                    const maxContentHeight = contentSpace >= fiveRowsPx ? contentSpace : fiveRowsPx;

                    return (
                      <div style={{ maxHeight: `${maxContentHeight}px`, overflowY: "auto" }} className="flex flex-col gap-1">
                        {rows}
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
                  const minAllowed = openTimeMin ?? 0;
                  const maxAllowed = (closeTimeMin ?? 1440) - 1;
                  const clampedTime = Math.max(minAllowed, Math.min(maxAllowed, p.timeMin));
                  executeDrop(p.col, clampedTime, p.data);
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
