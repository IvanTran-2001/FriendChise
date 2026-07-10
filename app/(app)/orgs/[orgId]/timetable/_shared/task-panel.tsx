"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Clock, MapPin } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import type { SharedTask } from "./types";

type LoadTasksResult = {
  tasks: SharedTask[];
  nextCursor: string | null;
};

interface TaskPanelProps {
  tasks: SharedTask[];
  loadTasks?: (
    search: string,
    cursor: string | null | undefined,
    signal: AbortSignal,
  ) => Promise<LoadTasksResult>;
  onDragStart: (taskId: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  selectedTaskId?: string | null;
  onTaskSelect?: (taskId: string | null) => void;
  tapToPlaceMode?: boolean;
  /** Called when a row is clicked in drag mode (not tapToPlaceMode). */
  onTaskClick?: (task: SharedTask) => void;
}

/**
 * Sidebar panel listing draggable tasks.
 * Used by both the live timetable and the template editor.
 */
export function TaskPanel({
  tasks,
  loadTasks,
  onDragStart,
  onDragEnd,
  selectedTaskId,
  onTaskSelect,
  tapToPlaceMode,
  onTaskClick,
}: TaskPanelProps) {
  const [search, setSearch] = useState("");
  const [loadedTasks, setLoadedTasks] = useState<SharedTask[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const listRootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!loadTasks) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(async () => {
      setLoadedTasks([]);
      setNextCursor(null);
      setIsLoading(true);
      try {
        const result = await loadTasks(search.trim(), undefined, controller.signal);
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoadedTasks(result.tasks);
          setNextCursor(result.nextCursor);
        }
      } catch {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoadedTasks([]);
          setNextCursor(null);
        }
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadTasks, search]);

  const visibleTasks = loadTasks ? loadedTasks : tasks;
  const filtered = useMemo(() => {
    if (loadTasks) return visibleTasks;
    const query = search.toLowerCase();
    return visibleTasks
      .filter((task) => task.name.toLowerCase().includes(query))
      .sort((a, b) => {
        if (a.roleName && b.roleName) return a.roleName.localeCompare(b.roleName);
        if (a.roleName) return -1;
        if (b.roleName) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [loadTasks, search, visibleTasks]);

  useEffect(() => {
    if (!loadTasks) return;
    const sentinel = sentinelRef.current;
    const root = listRootRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoading || !nextCursor) return;
        const controller = new AbortController();
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        void loadTasks(search.trim(), nextCursor, controller.signal)
          .then((result) => {
            if (controller.signal.aborted || requestId !== requestIdRef.current) return;
            setLoadedTasks((current) => [...current, ...result.tasks]);
            setNextCursor(result.nextCursor);
          })
          .catch(() => {
            if (!controller.signal.aborted && requestId === requestIdRef.current) {
              setNextCursor(null);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted && requestId === requestIdRef.current) {
              setIsLoading(false);
            }
          });
      },
      { root, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isLoading, loadTasks, nextCursor, search]);

  const grouped = filtered.reduce<Record<string, SharedTask[]>>((acc, task) => {
    const key = task.roleName ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const groups = Object.entries(grouped).sort(([a], [b]) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  const showInitialLoading = !!loadTasks && isLoading && filtered.length === 0;

  const rows =
    filtered.length === 0 && !showInitialLoading ? (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2 text-muted-foreground">
        <MapPin className="h-7 w-7 opacity-30" />
        <p className="text-sm">No tasks found</p>
      </div>
    ) : (
      groups.map(([roleName, roleTasks]) => (
        <div key={roleName || "__none"}>
          {roleName && (
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {roleName}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5 px-3 pb-2">
            {roleTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const isDragging = draggingId === task.id;
              const accentColor = task.roleColor ?? task.color ?? "#9ca3af";

              return (
                <div
                  key={task.id}
                  draggable={!tapToPlaceMode}
                  onDragStart={
                    !tapToPlaceMode
                      ? (e) => {
                          setDraggingId(task.id);
                          onDragStart(task.id, e);
                        }
                      : undefined
                  }
                  onDragEnd={
                    !tapToPlaceMode
                      ? () => {
                          setDraggingId(null);
                          onDragEnd();
                        }
                      : undefined
                  }
                  onClick={
                    tapToPlaceMode && onTaskSelect
                      ? () => onTaskSelect(isSelected ? null : task.id)
                      : onTaskClick
                        ? () => onTaskClick(task)
                        : undefined
                  }
                  role={tapToPlaceMode || onTaskClick ? "button" : undefined}
                  tabIndex={tapToPlaceMode || onTaskClick ? 0 : undefined}
                  aria-pressed={tapToPlaceMode ? isSelected : undefined}
                  onKeyDown={
                    tapToPlaceMode && onTaskSelect
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onTaskSelect(isSelected ? null : task.id);
                          }
                        }
                      : onTaskClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onTaskClick(task);
                            }
                          }
                        : undefined
                  }
                  className={`relative flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition-all select-none group ${
                    isDragging
                      ? "opacity-40 scale-95 shadow-none"
                      : isSelected
                        ? "border-primary/60 bg-primary/8 shadow-sm"
                        : "border-border bg-card hover:border-border/80 hover:shadow-sm hover:bg-muted/30"
                  } ${
                    tapToPlaceMode
                      ? "cursor-pointer"
                      : onTaskClick
                        ? "cursor-pointer active:scale-[0.98]"
                        : "cursor-grab active:cursor-grabbing active:scale-[0.98]"
                  }`}
                  style={{
                    borderLeftColor: accentColor,
                    borderLeftWidth: 3,
                  }}
                >
                  {!tapToPlaceMode && !onTaskClick && (
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-snug text-[13px]">
                      {task.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {task.durationMin} min
                      </span>
                    </div>
                  </div>

                  {tapToPlaceMode && isSelected && (
                    <span className="shrink-0 text-[10px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5 leading-tight">
                      Tap grid
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))
    );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2.5 border-b shrink-0">
        <SearchInput
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
          aria-label="Search tasks"
        />
      </div>
      {!tapToPlaceMode && (
        <div className="px-3 pt-2.5 pb-1 shrink-0">
          <p className="text-[10px] text-muted-foreground">
            Drag a task onto the calendar to schedule it
          </p>
        </div>
      )}
      <div ref={listRootRef} className="flex flex-col overflow-y-auto flex-1">
        {showInitialLoading && (
          <div className="mx-3 mt-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-muted-foreground">
            <p className="text-xs">Loading tasks…</p>
          </div>
        )}
        {rows}
        {loadTasks && isLoading && filtered.length > 0 && (
          <div className="px-3 py-2 text-center text-xs text-muted-foreground">
            Loading more…
          </div>
        )}
        {loadTasks && <div ref={sentinelRef} className="h-4" />}
      </div>
    </div>
  );
}
