"use client";

/**
 * @file template-editor-client.tsx
 * Client root for the timetable template editor page.
 *
 * Supports two view modes (`mode` prop, URL-driven):
 * - **Calendar** — drag-and-drop time grid using `TimeGrid`. Tasks are dragged from
 *   the `TaskPanel` sidebar (desktop) or a bottom Sheet (mobile). Entries can be
 *   repositioned by dragging. Column count adapts to container width via ResizeObserver.
 * - **Simple** — day-by-day table sorted by start time. Clicking a row opens
 *   the ActionSidebar to adjust start time and assignees.
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

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  LayersIcon,
  LayoutList,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addTemplateInstanceAction, updateTemplateInstanceAction, updateTemplateInstancesBatchAction } from "@/app/actions/templates";
import { TimeGrid } from "../../_shared/time-grid";
import type { DragDataRef } from "../../_shared/time-grid";
import { TaskPanel } from "../../_shared/task-panel";
import { minToHHMM } from "../../_shared/grid-utils";
import { useTimetableZoom } from "../../_shared/timetable-zoom-context";
import type { SharedTask, SharedMembership } from "../../_shared/types";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { registerDragHandlers, unregisterDragHandlers } from "../../_shared/drag-registry";
import Link from "next/link";

import { CalendarEditSidebarContent } from "./template-timetable-client/calendar-edit-sidebar-content";
import { TemplateSimpleView } from "./template-timetable-client/simple-view";

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
    membership: {
      id: string;
      botName: string | null;
      user: { id: string; name: string | null } | null;
    };
  }>;
};

export type ClientTask = SharedTask;
export type ClientMembership = SharedMembership;

// ---------------------------------------------------------------------------
// EditPopup (template-specific: no status field)
// ---------------------------------------------------------------------------

// EditPopup removed: edits now use the ActionSidebar via `openEditInSidebar`.

// ---------------------------------------------------------------------------
// EditSidebarContent — same form as EditPopup but renders inline in ActionSidebar
// ---------------------------------------------------------------------------

// EditSidebarContent has been extracted to ./calendar-edit-sidebar-content

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface TemplateEditorClientProps {
  orgId: string;
  templateId: string;
  templateDays: number;
  instances: ClientTemplateInstance[];
  availableTasks: ClientTask[];
  taskColors: Record<
    string,
    { color: string | null; roleColor: string | null; tagColor: string | null }
  >;
  memberships: ClientMembership[];
  todayStr: string;
  openTimeMin: number;
  closeTimeMin: number;
  fillHeight?: boolean;
  mode: "calendar" | "simple";
  span: "day" | "week";
  colorFilter: "task" | "role" | "tag";
  /** Rendered at the end of the toolbar (template name / metadata). */
  title?: ReactNode;
  /** Optional external dragging state controlled by a parent bridge. */
  isDraggingExternal?: boolean;
  /** Optional setter to update external dragging state. */
  onExternalDragChange?: (v: boolean) => void;
}

export function TemplateEditorClient({
  orgId,
  templateId,
  templateDays,
  instances,
  availableTasks,
  taskColors,
  memberships,
  todayStr: _todayStr,
  openTimeMin,
  closeTimeMin,
  fillHeight,
  mode,
  span,
  title,
  isDraggingExternal,
  onExternalDragChange,
  colorFilter,
}: TemplateEditorClientProps) {
  const router = useRouter();
  const [isPending, startT] = useTransition();
  const { open: openSidebar, close: closeSidebar, activeTitle } = useActionSidebar();
  const isMobile = useIsMobile();

  // ── Span & adaptive column count ──────────────────────────────────────
  // span and mode come from URL params via props
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
  const pageSize = mode === "simple" ? (span === "day" ? 1 : 7) : colCount;

  // Clamp only to [0, templateDays-1] — allows partial last page.
  const clampedStartDay = Math.max(0, Math.min(startDay, templateDays - 1));

  const visibleEnd = Math.min(clampedStartDay + pageSize, templateDays);
  const visibleDays = Array.from(
    { length: visibleEnd - clampedStartDay },
    (_, i) => clampedStartDay + i,
  );
  const columns = visibleDays.map(String);
  const focalDay = visibleDays[Math.floor(visibleDays.length / 2)];

  const canPrev = clampedStartDay > 0;
  const canNext = visibleEnd < templateDays;
  const navLabel =
    visibleDays.length === 1
      ? `Day ${clampedStartDay + 1} of ${templateDays}`
      : `Day ${clampedStartDay + 1}–${visibleEnd} of ${templateDays}`;

  // ── Drag / tap / landscape state ─────────────────────────────────────
  type DragData =
    | { type: "task"; taskId: string }
    | { type: "move"; instanceId: string; offsetMin: number }
    | { type: "group"; instanceIds: string[]; instances?: ClientTemplateInstance[]; groupStartMin: number; offsetMin: number };
  const dragDataRef = useRef<DragData | null>(null) as DragDataRef<ClientTemplateInstance>;
  const [dragOver, setDragOver] = useState<{
    column: string;
    timeMin: number;
  } | null>(null);
  const { hourHeight } = useTimetableZoom();

  const getTaskColor = useCallback((inst: ClientTemplateInstance) => {
    const entry = taskColors[inst.task.id];
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

  const getTaskColorMaybe = useCallback((inst: ClientTemplateInstance) => {
    const entry = taskColors[inst.task.id];
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

  // Track the slot (dayIndex + time range) of the currently open group sidebar.
  const openGroupSlotRef = useRef<{ dayIndex: number; startMin: number; endMin: number } | null>(null);
  const lastGroupTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTitle) {
      openGroupSlotRef.current = null;
      lastGroupTitleRef.current = null;
      return;
    }
    if (lastGroupTitleRef.current && activeTitle !== lastGroupTitleRef.current) {
      openGroupSlotRef.current = null;
      lastGroupTitleRef.current = null;
    }
  }, [activeTitle]);
  const [isDraggingInternal, setIsDraggingInternal] = useState(false);
  const isDragging = typeof isDraggingExternal === "boolean" ? isDraggingExternal : isDraggingInternal;
  const setIsDragging = onExternalDragChange ?? setIsDraggingInternal;

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, [setIsDragging]);

  useEffect(() => {
    registerDragHandlers({ setIsDragging });
    return () => unregisterDragHandlers();
  }, [setIsDragging]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const handler = () => setTaskPanelOpen(true);
    window.addEventListener("template:open-task-panel", handler);
    return () =>
      window.removeEventListener("template:open-task-panel", handler);
  }, []);

  // Track when the sidebar's schedule form is open so we can suppress the
  // empty-state overlay (otherwise the overlay blocks the grid).
  const [isScheduling, setIsScheduling] = useState(false);
  useEffect(() => {
    const onEnter = () => setIsScheduling(true);
    const onExit = () => setIsScheduling(false);
    window.addEventListener("template:schedule-mode-enter", onEnter);
    window.addEventListener("template:schedule-mode-exit", onExit);
    return () => {
      window.removeEventListener("template:schedule-mode-enter", onEnter);
      window.removeEventListener("template:schedule-mode-exit", onExit);
    };
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

  const openEditInSidebar = useCallback(
    (inst: ClientTemplateInstance, onBack?: () => void) => {
      openSidebar(
        inst.task.name,
        <CalendarEditSidebarContent
          key={inst.id}
          instance={inst}
          taskColor={getTaskColor(inst)}
          memberships={memberships}
          orgId={orgId}
          onClose={closeSidebar}
          onBack={onBack}
        />,
      );
    },
    [openSidebar, closeSidebar, memberships, orgId, getTaskColor],
  );

  function openGroupSidebar(groupInstances: ClientTemplateInstance[]) {
    const groupStart = Math.min(...groupInstances.map((i) => i.startTimeMin));
    const groupEnd = Math.max(
      ...groupInstances.map((i) => i.startTimeMin + i.task.durationMin),
    );
    // store canonical slot so effect can re-derive membership on instance updates
    openGroupSlotRef.current = { dayIndex: groupInstances[0].dayIndex, startMin: groupStart, endMin: groupEnd };
    const title = `${groupInstances.length} overlapping · ${minToHHMM(groupStart)}–${minToHHMM(groupEnd)}`;
    lastGroupTitleRef.current = title;
    openSidebar(
      title,
      <div className="flex flex-col gap-2 p-3">
        {groupInstances.map((inst) => {
          const assigneeNames = inst.assignees
            .map((a) => a.membership.user?.name ?? a.membership.botName ?? "Bot")
            .join(", ");
          return (
            <div
              key={inst.id}
              draggable
              onDragStart={(e) => {
                dragDataRef.current = {
                  type: "move",
                  instanceId: inst.id,
                  offsetMin: 0,
                };
                e.dataTransfer.effectAllowed = "move";
                setIsDragging(true);
              }}
              onDragEnd={handleDragEnd}
              onClick={() => openEditInSidebar(inst)}
              className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: getTaskColor(inst) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{inst.task.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {minToHHMM(inst.startTimeMin)}&ndash;
                    {minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                  </span>
                </div>
                {assigneeNames && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {assigneeNames}
                  </div>
                )}
              </div>
              <Link
                href={`/orgs/${orgId}/tasks/${inst.task.id}`}
                onClick={(e) => { e.stopPropagation(); closeSidebar(); }}
                className="shrink-0 h-6 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors"
                aria-label="Open task detail"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>,
    );
  }

  // Re-open the group sidebar with fresh data whenever `instances` changes
  // (triggered by `router.refresh()` after mutations). The effect below
  // re-derives the current members of that slot by checking overlap against
  // the fresh `instances` prop and re-opens the sidebar with a new `key`
  // so the content remounts.
  useEffect(() => {
    const slot = openGroupSlotRef.current;
    if (!slot) return;

    const freshGroup = instances.filter(
      (i) =>
        i.dayIndex === slot.dayIndex &&
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
      <div key={freshGroup.map((i) => `${i.id}:${i.startTimeMin}:${i.dayIndex}`).join(",")} className="flex flex-col gap-2 p-3">
        {freshGroup.map((inst) => {
          const assigneeNames = inst.assignees
            .map((a) => a.membership.user?.name ?? a.membership.botName ?? "Bot")
            .join(", ");
          return (
            <div
              key={inst.id}
              draggable
              onDragStart={(e) => {
                dragDataRef.current = { type: "move", instanceId: inst.id, offsetMin: 0 };
                e.dataTransfer.effectAllowed = "move";
                setIsDragging(true);
              }}
              onDragEnd={handleDragEnd}
              onClick={() => openEditInSidebar(inst)}
              className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/40 transition-colors cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: getTaskColor(inst) }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{inst.task.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {minToHHMM(inst.startTimeMin)}&ndash;{minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                  </span>
                </div>
                {assigneeNames && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{assigneeNames}</div>}
              </div>
              <Link href={`/orgs/${orgId}/tasks/${inst.task.id}`} onClick={(e) => { e.stopPropagation(); closeSidebar(); }} className="shrink-0 h-6 w-6 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Open task detail">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>,
    );
  }, [instances]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDrop(col: string, timeMin: number, data: DragData) {
    const day = parseInt(col, 10);

    if (data.type === "group") {
      const insts = (data.instances ?? data.instanceIds.map((id) => instances.find((i) => i.id === id)).filter(Boolean)) as ClientTemplateInstance[];
      if (insts.length === 0) return;
      const delta = timeMin - data.groupStartMin;
      startT(async () => {
        try {
          const updates = insts.map((inst) => ({
            id: inst.id,
            dayIndex: day,
            startTimeMin: Math.max(0, Math.min(1439, inst.startTimeMin + delta)),
          }));
          const res = await updateTemplateInstancesBatchAction(orgId, updates);
          if (!res.ok) {
            toast.error(res.error ?? "Something went wrong");
            return;
          }
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Something went wrong");
        }
      });
      return;
    }

    startT(async () => {
      try {
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
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong");
          return;
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handleTapPlace(col: string, timeMin: number, taskId: string) {
    const day = parseInt(col, 10);
    startT(async () => {
      try {
        const result = await addTemplateInstanceAction(
          orgId,
          templateId,
          taskId,
          day,
          timeMin,
        );
        if (!result.ok) {
          toast.error(result.error ?? "Something went wrong");
          return;
        }
        setSelectedTaskId(null);
        setTaskPanelOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  // Edits now open in the ActionSidebar; inline popup handlers removed.

  return (
    <div
      className={`${fillHeight ? "flex flex-col flex-1 min-h-0" : "flex flex-col gap-4"}${isPending ? " opacity-40 pointer-events-none" : ""}`}
    >
      {/* ── Navigation toolbar ── */}
      <RegisterPageToolbar>
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
            onClick={() => setStartDay(clampedStartDay + pageSize)}
            disabled={!canNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs shrink-0 transition-opacity duration-200${
            clampedStartDay === 0 ? " opacity-0 pointer-events-none" : ""
          }`}
          onClick={() => setStartDay(0)}
          disabled={clampedStartDay === 0}
        >
          Start
        </Button>
        {title && <div className="ml-auto">{title}</div>}
      </RegisterPageToolbar>

      {/* ── Simple list view ── */}
      {mode === "simple" && (
        <TemplateSimpleView
          instances={instances}
          visibleDays={visibleDays}
          templateDays={templateDays}
          memberships={memberships}
          orgId={orgId}
          templateId={templateId}
          availableTasks={availableTasks}
          taskColors={taskColors}
          colorFilter={colorFilter}
        />
      )}

      {/* ── Grid + desktop panel ── */}
      {mode === "calendar" && (
        <div className={`flex gap-4${fillHeight ? " flex-1 min-h-0" : ""}`}>
          <div
            ref={containerRef}
            className={`relative flex-1 min-w-0${fillHeight ? " min-h-0 flex flex-col" : ""}`}
          >
            {/* Empty state — hidden during tap-to-place, drag, or schedule form */}
            {!visibleInstances.length &&
              !isDragging &&
              !selectedTaskId &&
              !isScheduling && (
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
              columnHighlightClass={(col) =>
                col === String(focalDay) ? "bg-primary/[0.04] text-foreground" : undefined
              }
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
                    <div className="text-[9px] font-mono text-muted-foreground/80 leading-none mb-0.5 tabular-nums">
                      {minToHHMM(inst.startTimeMin)}–{minToHHMM(inst.startTimeMin + inst.task.durationMin)}
                    </div>
                    <span className="font-semibold truncate block leading-tight">
                      {inst.task.name}
                    </span>
                    {assigneeNames && (
                      <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                        {assigneeNames}
                      </div>
                    )}
                  </>
                );
              }}
              dragDataRef={dragDataRef as DragDataRef<ClientTemplateInstance>}
              onDragOver={(col, timeMin) =>
                setDragOver({ column: col, timeMin })
              }
              onDrop={handleDrop}
              onDragLeave={() => setDragOver(null)}
              dragOver={dragOver}
              onBlockMenuClick={(inst) =>
                router.push(`/orgs/${orgId}/tasks/${inst.task.id}`)
              }
              onBlockClick={openEditInSidebar}
              draggable
              initialScrollMin={initialScrollMin}
              openTimeMin={openTimeMin}
              closeTimeMin={closeTimeMin}
              fillHeight={fillHeight}
              hourHeight={hourHeight}
              blockColor={(inst) => getTaskColorMaybe(inst)}
              selectedTaskId={isMobile ? selectedTaskId : null}
              onTapPlace={isMobile ? handleTapPlace : undefined}
              onGroupClick={(groupInstances) => openGroupSidebar(groupInstances)}
              renderGroupBlock={(instances, groupStart, groupEnd, _heightPx) => (
                <>
                  <div className="flex items-center justify-between gap-1 mb-1 shrink-0">
                    <span className="text-[9px] font-mono text-muted-foreground/70 leading-none tabular-nums">
                      {minToHHMM(groupStart)}–{minToHHMM(groupEnd)}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-300 leading-none">
                      <LayersIcon className="h-2.5 w-2.5" />
                      {instances.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {instances.map((inst) => {
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
                            <span className="text-[10px] font-semibold truncate leading-tight block">
                              {inst.task.name}
                            </span>
                            {assigneeNames && (
                              <span className="text-[9px] text-muted-foreground/70 truncate leading-tight block pl-0">
                                {assigneeNames}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <ChevronRight className="absolute bottom-1 right-1 h-3 w-3 text-muted-foreground/40" />
                </>
              )}
            />
          </div>
        </div>
      )}

      {/* Mobile: floating Tasks / Cancel button + Sheet */}
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
                isLandscape ? "w-64 p-0 flex flex-col" : "p-0 flex flex-col"
              }
            >
              <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
                <SheetTitle>Tasks</SheetTitle>
              </SheetHeader>
              <TaskPanel
                tasks={availableTasks}
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

      {/* Editing now uses ActionSidebar; inline popup removed. */}
    </div>
  );
}
