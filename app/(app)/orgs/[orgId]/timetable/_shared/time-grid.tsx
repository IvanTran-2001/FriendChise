"use client";

import { useRef, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { HOUR_HEIGHT, MIN_BLOCK_HEIGHT, calcDropTimeMin, groupOverlapping, type OverlapGroup } from "./grid-utils";

/**
 * Converts any CSS color to an rgba() string with the given alpha.
 * Handles 3-digit (#rgb), 6-digit (#rrggbb) and 8-digit (#rrggbbaa) hex.
 * Falls back to `color-mix` for non-hex values (rgb, hsl, named colors).
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (hex.startsWith("#")) {
    let r: number, g: number, b: number;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // For rgb(), hsl(), named colors, CSS variables — use color-mix (supported in all modern browsers)
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

/** Minimal shape a grid instance must satisfy. */
export type GridInstance = {
  id: string;
  startTimeMin: number;
  task: { durationMin: number; title?: string };
};

type DragData<TInstance extends GridInstance = GridInstance> =
  | { type: "task"; taskId: string }
  | { type: "move"; instanceId: string; offsetMin: number }
  | {
      type: "group";
      instanceIds: string[];
      /** Optional: pass full instance objects for faster client-side mapping */
      instances?: TInstance[];
      groupStartMin: number;
      offsetMin: number;
    };

export type DragDataRef<TInstance extends GridInstance = GridInstance> =
  React.MutableRefObject<DragData<TInstance> | null>;

interface TimeGridProps<
  TInstance extends GridInstance,
  TColumnKey extends string,
> {
  /** Each column key (e.g. a date string or "0", "1", "2" day index). */
  columns: TColumnKey[];

  /** All instances to display, belonging to any of the columns. */
  instances: TInstance[];

  /** Derives the column key for a given instance. */
  getColumnKey: (instance: TInstance) => TColumnKey;

  /** Renders the header cell for a column. */
  renderColumnHeader: (column: TColumnKey) => React.ReactNode;

  /**
   * Renders the content inside a positioned task block.
   * Receives the instance and the block's pixel height so renderers can
   * conditionally show detail rows only when there's room.
   */
  renderBlock: (instance: TInstance, heightPx: number) => React.ReactNode;

  /** Shared drag-data ref. Owned by the parent so it can be read during drop. */
  dragDataRef: DragDataRef<TInstance>;

  /** Called when the user drags over a column. */
  onDragOver: (column: TColumnKey, timeMin: number) => void;

  /** Called when the user drops onto a column. */
  onDrop: (column: TColumnKey, timeMin: number, data: DragData<TInstance>) => void;

  /** Called when the drag leaves all columns. */
  onDragLeave: () => void;

  /** Column key + time of the current drag-over highlight, or null. */
  dragOver: { column: TColumnKey; timeMin: number } | null;

  /** Called when the ··· menu button on a block is clicked. */
  onBlockMenuClick?: (instance: TInstance) => void;

  /** Called when the user clicks a block (non-drag). Use for navigation. */
  onBlockClick?: (instance: TInstance) => void;

  /** Whether blocks should be draggable (move). */
  draggable?: boolean;

  /** Minutes-from-midnight to auto-scroll to on mount/column-set change. */
  initialScrollMin?: number;

  fillHeight?: boolean;

  /** Extra CSS class applied to a column when it is "today" or otherwise highlighted. */
  columnHighlightClass?: (column: TColumnKey) => string | undefined;

  /** Returns a hex/CSS color for a block's border and tinted background. */
  blockColor?: (instance: TInstance) => string | null | undefined;

  /** Render a shaded band and line at the org's open/close hours. */
  openTimeMin?: number;
  closeTimeMin?: number;

  /** Tap-to-place mode: when set, clicking a column places this task. */
  selectedTaskId?: string | null;
  onTapPlace?: (column: TColumnKey, timeMin: number, taskId: string) => void;

  /**
   * Renders the combined card for an overlap group (2+ instances).
   * If omitted a simple fallback showing the count is rendered.
   */
  renderGroupBlock?: (
    instances: TInstance[],
    groupStart: number,
    groupEnd: number,
    heightPx: number,
  ) => React.ReactNode;

  /** Called when the user clicks a group card. */
  onGroupClick?: (instances: TInstance[]) => void;

  /** Pixel height per hour. Defaults to HOUR_HEIGHT (150). */
  hourHeight?: number;
}

/**
 * The core 24-hour scrollable time grid.
 * Renders hour gutters, day/cycle columns, drag-drop, and block layout.
 * Column headers and block content are fully customisable via render props
 * so this component knows nothing about dates vs template day indices,
 * or status vs no-status entries.
 */
export function TimeGrid<
  TInstance extends GridInstance,
  TColumnKey extends string,
>({
  columns,
  instances,
  getColumnKey,
  renderColumnHeader,
  renderBlock,
  dragDataRef,
  onDragOver,
  onDrop,
  onDragLeave,
  dragOver,
  onBlockMenuClick,
  onBlockClick,
  draggable = true,
  initialScrollMin = 0,
  fillHeight,
  columnHighlightClass,
  blockColor,
  openTimeMin,
  closeTimeMin,
  selectedTaskId,
  onTapPlace,
  renderGroupBlock,
  onGroupClick,
  hourHeight = HOUR_HEIGHT,
}: TimeGridProps<TInstance, TColumnKey>) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const totalHeight = hours.length * hourHeight;

  // Group instances by column key
  const byColumn = new Map<TColumnKey, TInstance[]>();
  for (const inst of instances) {
    const key = getColumnKey(inst);
    if (!byColumn.has(key)) byColumn.set(key, []);
    byColumn.get(key)!.push(inst);
  }

  // Auto-scroll to initialScrollMin on column set change
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track pointer-down position so we can distinguish a click from a drag
  const pointerDownPos = useRef<{ x: number; y: number; id: string } | null>(
    null,
  );
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollTo = Math.max(
      0,
      Math.floor(initialScrollMin / 60) * hourHeight - hourHeight / 2,
    );
    const el = scrollRef.current;
    let rafId1: number | null = null;
    let rafId2: number | null = null;
    // Double-rAF: first tick lets React commit the layout, second tick lets
    // the browser resolve flex heights (needed for fillHeight containers where
    // scrollHeight isn't accurate after a single rAF).
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        if (scrollRef.current) {
          el.scrollTop = scrollTo;
        }
      });
    });
    return () => {
      if (rafId1 !== null) cancelAnimationFrame(rafId1);
      if (rafId2 !== null) cancelAnimationFrame(rafId2);
    };
    // Intentionally only runs when the column set changes (week/page nav)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join(","), initialScrollMin]);

  function handleColumnDragOver(
    e: React.DragEvent<HTMLDivElement>,
    col: TColumnKey,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect =
      dragDataRef.current?.type === "move" || dragDataRef.current?.type === "group"
        ? "move"
        : "copy";
    const offsetMin =
      dragDataRef.current?.type === "move" || dragDataRef.current?.type === "group"
        ? dragDataRef.current.offsetMin
        : 0;
    onDragOver(col, calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin, hourHeight));
  }

  function handleColumnDrop(
    e: React.DragEvent<HTMLDivElement>,
    col: TColumnKey,
  ) {
    e.preventDefault();
    let data = dragDataRef.current;
    dragDataRef.current = null;
    // Fallback: task drags originating outside this component tree
    // (e.g. from the ActionSidebar) communicate via dataTransfer.
    if (!data) {
      const taskId = e.dataTransfer.getData("timetable/taskId");
      if (taskId) data = { type: "task", taskId };
    }
    if (!data) return;
    const offsetMin = data.type === "move" || data.type === "group" ? data.offsetMin : 0;
    onDrop(
      col,
      calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin, hourHeight),
      data,
    );
    // Clear drag-over highlight after handling the drop so the drop indicator
    // doesn't persist on screen.
    onDragLeave();
  }

  function handleColumnClick(
    e: React.MouseEvent<HTMLDivElement>,
    col: TColumnKey,
  ) {
    if (!selectedTaskId || !onTapPlace) return;
    const timeMin = calcDropTimeMin(e.clientY, e.currentTarget, 0, 0, hourHeight);
    onTapPlace(col, timeMin, selectedTaskId);
  }

  // Min px width per column so week view is horizontally scrollable on mobile
  const MIN_COL_WIDTH = 80;
  const minGridWidth =
    columns.length > 1
      ? `${14 * 4 + columns.length * MIN_COL_WIDTH}px`
      : undefined;

  return (
    <div
      className={`rounded-xl border border-border overflow-hidden${fillHeight ? " flex flex-col flex-1 min-h-0" : ""}`}
    >
      {/* Horizontal scroll wrapper — must be flex-col so the inner flex-1 scrollable div gets height */}
      <div
        className={`overflow-x-auto${fillHeight ? " flex flex-col flex-1 min-h-0" : ""}`}
      >
        {/* Column headers */}
        <div
          className="flex border-b border-border bg-card"
          style={minGridWidth ? { minWidth: minGridWidth } : undefined}
        >
          <div className="w-14 shrink-0 border-r border-border" />
          {columns.map((col) => (
            <div
              key={col}
              className={`py-2 text-center text-sm border-r border-border last:border-r-0 ${columnHighlightClass?.(col) ?? "text-muted-foreground"}`}
              style={{ minWidth: MIN_COL_WIDTH, flex: 1 }}
            >
              {renderColumnHeader(col)}
            </div>
          ))}
        </div>

        {/* Scrollable grid */}
        <div
          ref={scrollRef}
          className={
            fillHeight
              ? "overflow-y-auto bg-card flex-1 min-h-0"
              : "overflow-y-auto bg-card"
          }
          style={
            fillHeight
              ? minGridWidth
                ? { minWidth: minGridWidth }
                : undefined
              : {
                  height: "calc(100dvh - 220px)",
                  ...(minGridWidth ? { minWidth: minGridWidth } : {}),
                }
          }
        >
          <div
            className="flex"
            style={{
              height: totalHeight,
              ...(minGridWidth ? { minWidth: minGridWidth } : {}),
            }}
          >
            {/* Hour-label gutter */}
            <div className="w-14 shrink-0 border-r border-border">
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ height: hourHeight }}
                  className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b border-border/50 select-none"
                >
                  {`${h}:00`}
                </div>
              ))}
            </div>

            {/* Columns */}
            {columns.map((col) => {
              const colInstances = byColumn.get(col) ?? [];
              const isDragTarget = dragOver?.column === col;
              const highlightClass = columnHighlightClass?.(col);

              return (
                <div
                  key={col}
                  className={`flex-1 relative border-r border-border last:border-r-0 transition-colors ${highlightClass ? "bg-primary/5" : ""} ${isDragTarget ? "bg-primary/10" : ""} ${selectedTaskId ? "cursor-crosshair" : ""}`}
                  style={{ height: totalHeight }}
                  onDragOver={(e) => handleColumnDragOver(e, col)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      onDragLeave();
                  }}
                  onDrop={(e) => handleColumnDrop(e, col)}
                  onClick={(e) => handleColumnClick(e, col)}
                >
                  {/* Outside-hours shading */}
                  {openTimeMin !== undefined && openTimeMin > 0 && (
                    <div
                      className={`absolute inset-x-0 pointer-events-none z-0 ${highlightClass ? "bg-muted/70" : "bg-muted/40"}`}
                      style={{
                        top: 0,
                        height: (openTimeMin / 60) * hourHeight,
                      }}
                    />
                  )}
                  {closeTimeMin !== undefined && closeTimeMin < 1440 && (
                    <div
                      className={`absolute inset-x-0 pointer-events-none z-0 ${highlightClass ? "bg-muted/70" : "bg-muted/40"}`}
                      style={{
                        top: (closeTimeMin / 60) * hourHeight,
                        height: totalHeight - (closeTimeMin / 60) * hourHeight,
                      }}
                    />
                  )}
                  {/* Open/close boundary lines */}
                  {openTimeMin !== undefined && openTimeMin > 0 && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-primary/40 pointer-events-none z-10"
                      style={{ top: (openTimeMin / 60) * hourHeight }}
                    />
                  )}
                  {closeTimeMin !== undefined && closeTimeMin < 1440 && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-primary/40 pointer-events-none z-10"
                      style={{ top: (closeTimeMin / 60) * hourHeight }}
                    />
                  )}

                  {/* Hour lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-b border-border/40 pointer-events-none"
                      style={{ top: h * hourHeight, height: hourHeight }}
                    />
                  ))}

                  {/* Drop indicator */}
                  {isDragTarget && dragOver && (
                    <div
                      className="absolute inset-x-1 h-0.5 bg-primary z-10 pointer-events-none rounded"
                      style={{ top: (dragOver.timeMin / 60) * hourHeight }}
                    />
                  )}

                  {/* Task blocks */}
                  {groupOverlapping(colInstances, hourHeight).map((group: OverlapGroup<TInstance>) => {
                      const groupKey = group.instances.map((i) => i.id).join("+");
                      const topPx = (group.startTimeMin / 60) * hourHeight;
                      const durationMin = group.endTimeMin - group.startTimeMin;
                      // groupOverlapping already clamps endTimeMin to MIN_BLOCK_HEIGHT
                      // so heightPx will always be >= MIN_BLOCK_HEIGHT here.
                      const heightPx = Math.max(
                        (durationMin / 60) * hourHeight,
                        MIN_BLOCK_HEIGHT,
                      );

                      // ── Single instance — existing behaviour ──────────────────
                      if (group.instances.length === 1) {
                        const inst = group.instances[0];
                        return (
                          <div
                            key={inst.id}
                            draggable={draggable}
                            onDragStart={
                              draggable
                                ? (e) => {
                                    const rect =
                                      e.currentTarget.getBoundingClientRect();
                                    dragDataRef.current = {
                                      type: "move",
                                      instanceId: inst.id,
                                      offsetMin:
                                        ((e.clientY - rect.top) / hourHeight) *
                                        60,
                                    };
                                    e.dataTransfer.effectAllowed = "move";
                                  }
                                : undefined
                            }
                            onDragEnd={
                              draggable
                                ? () => {
                                    dragDataRef.current = null;
                                    onDragLeave();
                                  }
                                : undefined
                            }
                            onPointerDown={(e) => {
                              pointerDownPos.current = {
                                x: e.clientX,
                                y: e.clientY,
                                id: inst.id,
                              };
                            }}
                            onClick={(e) => {
                              if (!onBlockClick) return;
                              const down = pointerDownPos.current;
                              if (down && down.id === inst.id) {
                                const dx = e.clientX - down.x;
                                const dy = e.clientY - down.y;
                                if (Math.sqrt(dx * dx + dy * dy) > 6) return;
                              }
                              e.stopPropagation();
                              onBlockClick(inst);
                            }}
                            onKeyDown={
                              onBlockClick
                                ? (e) => {
                                    if (e.key !== "Enter" && e.key !== " ")
                                      return;
                                    if (e.key === " ") e.preventDefault();
                                    e.stopPropagation();
                                    onBlockClick(inst);
                                  }
                                : undefined
                            }
                            role={onBlockClick ? "button" : undefined}
                            tabIndex={onBlockClick ? 0 : undefined}
                            className={`absolute rounded-md p-1.5 text-[11px] leading-snug bg-white border-2 border-primary/50 text-foreground shadow-sm hover:border-primary/80 hover:shadow transition-all select-none ${draggable ? "cursor-grab active:cursor-grabbing" : onBlockClick ? "cursor-pointer" : "cursor-default"}`}
                            style={{
                              top: topPx + 1,
                              minHeight: Math.max(heightPx - 2, MIN_BLOCK_HEIGHT - 2),
                              left: 2,
                              right: 2,
                              zIndex: 1,
                              ...(blockColor?.(inst)
                                ? {
                                    borderColor: blockColor(inst)!,
                                    backgroundColor: withAlpha(
                                      blockColor(inst)!,
                                      0.094,
                                    ),
                                  }
                                : {
                                    borderColor: "#9ca3af",
                                    backgroundColor: withAlpha("#9ca3af", 0.094),
                                  }),
                            }}
                          >
                            {renderBlock(inst, heightPx)}
                            {onBlockMenuClick && (
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onBlockMenuClick(inst);
                                }}
                                data-tour-target={
                                  inst.task.title === "Fry Morning Batches"
                                    ? "timetable-fry-morning-batches-open-task"
                                    : undefined
                                }
                                className="absolute top-0.5 right-0.5 flex items-center justify-center w-5 h-5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-black/10 transition-colors cursor-pointer"
                                aria-label="Open task"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      }

                      // ── Overlap group card ────────────────────────────────────
                      return (
                        <div
                          key={groupKey}
                          role="button"
                          tabIndex={0}
                          draggable={draggable && !!onGroupClick}
                          onDragStart={
                            draggable && onGroupClick
                              ? (e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  dragDataRef.current = {
                                    type: "group",
                                    instanceIds: group.instances.map((i) => i.id),
                                    instances: group.instances,
                                    groupStartMin: group.startTimeMin,
                                    offsetMin: ((e.clientY - rect.top) / hourHeight) * 60,
                                  };
                                  e.dataTransfer.effectAllowed = "move";
                                }
                              : undefined
                          }
                          onDragEnd={
                            draggable && onGroupClick
                              ? () => {
                                  dragDataRef.current = null;
                                  onDragLeave();
                                }
                              : undefined
                          }
                          onPointerDown={(e) => {
                            pointerDownPos.current = {
                              x: e.clientX,
                              y: e.clientY,
                              id: groupKey,
                            };
                          }}
                          onClick={(e) => {
                            const down = pointerDownPos.current;
                            if (down && down.id === groupKey) {
                              const dx = e.clientX - down.x;
                              const dy = e.clientY - down.y;
                              if (Math.sqrt(dx * dx + dy * dy) > 6) return;
                            }
                            e.stopPropagation();
                            onGroupClick?.(group.instances);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            if (e.key === " ") e.preventDefault();
                            e.stopPropagation();
                            onGroupClick?.(group.instances);
                          }}
                          className={`absolute rounded-md p-1.5 text-[11px] leading-snug border-2 text-foreground shadow-sm hover:shadow-md transition-all select-none ${draggable && onGroupClick ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                          style={{
                            top: topPx + 1,
                            minHeight: Math.max(heightPx - 2, MIN_BLOCK_HEIGHT - 2),
                            left: 2,
                            right: 2,
                            zIndex: 2,
                            borderColor: "#818cf8",
                            backgroundColor: withAlpha("#818cf8", 0.08),
                          }}
                        >
                          {renderGroupBlock
                            ? renderGroupBlock(
                                group.instances,
                                group.startTimeMin,
                                group.endTimeMin,
                                heightPx,
                              )
                            : (
                              <span className="font-semibold">
                                {group.instances.length} tasks
                              </span>
                            )}
                        </div>
                      );
                    },
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>{" "}
      {/* end overflow-x-auto */}
    </div>
  );
}
