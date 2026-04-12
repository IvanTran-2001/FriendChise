"use client";

import { useRef, useEffect } from "react";
import { HOUR_HEIGHT, calcDropTimeMin, assignColumns } from "./grid-utils";

/** Minimal shape a grid instance must satisfy. */
export type GridInstance = {
  id: string;
  startTimeMin: number;
  task: { durationMin: number };
};

type DragData<TInstanceId extends string = string> =
  | { type: "task"; taskId: string }
  | { type: "move"; instanceId: TInstanceId; offsetMin: number };

export type DragDataRef<TInstanceId extends string = string> =
  React.MutableRefObject<DragData<TInstanceId> | null>;

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
  dragDataRef: DragDataRef;

  /** Called when the user drags over a column. */
  onDragOver: (column: TColumnKey, timeMin: number) => void;

  /** Called when the user drops onto a column. */
  onDrop: (column: TColumnKey, timeMin: number, data: DragData) => void;

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
}: TimeGridProps<TInstance, TColumnKey>) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const totalHeight = hours.length * HOUR_HEIGHT;

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
  const pointerDownPos = useRef<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollTo = Math.max(
      0,
      Math.floor(initialScrollMin / 60) * HOUR_HEIGHT - HOUR_HEIGHT / 2,
    );
    scrollRef.current.scrollTop = scrollTo;
    // Intentionally only runs when the column set changes (week/page nav)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join(",")]);

  function handleColumnDragOver(
    e: React.DragEvent<HTMLDivElement>,
    col: TColumnKey,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect =
      dragDataRef.current?.type === "move" ? "move" : "copy";
    const offsetMin =
      dragDataRef.current?.type === "move" ? dragDataRef.current.offsetMin : 0;
    onDragOver(col, calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin));
  }

  function handleColumnDrop(
    e: React.DragEvent<HTMLDivElement>,
    col: TColumnKey,
  ) {
    e.preventDefault();
    const data = dragDataRef.current;
    dragDataRef.current = null;
    if (!data) return;
    const offsetMin = data.type === "move" ? data.offsetMin : 0;
    onDrop(
      col,
      calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin),
      data,
    );
  }

  return (
    <div
      className={`rounded-xl border border-border overflow-hidden${fillHeight ? " flex flex-col flex-1 min-h-0" : ""}`}
    >
      {/* Column headers */}
      <div className="flex border-b border-border bg-card">
        <div className="w-14 shrink-0 border-r border-border" />
        {columns.map((col) => (
          <div
            key={col}
            className={`flex-1 py-2 text-center text-sm border-r border-border last:border-r-0 ${columnHighlightClass?.(col) ?? "text-muted-foreground"}`}
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
        style={fillHeight ? undefined : { height: "calc(100dvh - 220px)" }}
      >
        <div className="flex" style={{ height: totalHeight }}>
          {/* Hour-label gutter */}
          <div className="w-14 shrink-0 border-r border-border">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b border-border/50 select-none"
              >
                {`${h}:00`}
              </div>
            ))}
          </div>

          {/* Columns */}
          {columns.map((col) => {
            const colInstances = byColumn.get(col) ?? [];
            const positioned = assignColumns(colInstances);
            const isDragTarget = dragOver?.column === col;
            const highlightClass = columnHighlightClass?.(col);

            return (
              <div
                key={col}
                className={`flex-1 relative border-r border-border last:border-r-0 transition-colors ${highlightClass ? "bg-primary/5" : ""} ${isDragTarget ? "bg-primary/8" : ""}`}
                style={{ height: totalHeight }}
                onDragOver={(e) => handleColumnDragOver(e, col)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    onDragLeave();
                }}
                onDrop={(e) => handleColumnDrop(e, col)}
              >
                {/* Outside-hours shading */}
                {openTimeMin !== undefined && openTimeMin > 0 && (
                  <div
                    className="absolute inset-x-0 bg-muted/40 pointer-events-none z-0"
                    style={{ top: 0, height: (openTimeMin / 60) * HOUR_HEIGHT }}
                  />
                )}
                {closeTimeMin !== undefined && closeTimeMin < 1440 && (
                  <div
                    className="absolute inset-x-0 bg-muted/40 pointer-events-none z-0"
                    style={{ top: (closeTimeMin / 60) * HOUR_HEIGHT, height: totalHeight - (closeTimeMin / 60) * HOUR_HEIGHT }}
                  />
                )}
                {/* Open/close boundary lines */}
                {openTimeMin !== undefined && openTimeMin > 0 && (
                  <div
                    className="absolute inset-x-0 border-t-2 border-primary/40 pointer-events-none z-10"
                    style={{ top: (openTimeMin / 60) * HOUR_HEIGHT }}
                  />
                )}
                {closeTimeMin !== undefined && closeTimeMin < 1440 && (
                  <div
                    className="absolute inset-x-0 border-t-2 border-primary/40 pointer-events-none z-10"
                    style={{ top: (closeTimeMin / 60) * HOUR_HEIGHT }}
                  />
                )}

                {/* Hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-b border-border/40 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Drop indicator */}
                {isDragTarget && dragOver && (
                  <div
                    className="absolute inset-x-1 h-0.5 bg-primary z-10 pointer-events-none rounded"
                    style={{ top: (dragOver.timeMin / 60) * HOUR_HEIGHT }}
                  />
                )}

                {/* Task blocks */}
                {positioned.map(
                  ({ instance: inst, col: colSlot, totalCols }) => {
                    const topPx = (inst.startTimeMin / 60) * HOUR_HEIGHT;
                    const visibleDurationMin = Math.min(
                      inst.task.durationMin,
                      Math.max(0, 1440 - inst.startTimeMin),
                    );
                    const heightPx = Math.max(
                      (visibleDurationMin / 60) * HOUR_HEIGHT,
                      20,
                    );
                    const widthPct = 100 / totalCols;
                    const leftPct = colSlot * widthPct;

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
                                    ((e.clientY - rect.top) / HOUR_HEIGHT) * 60,
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
                          pointerDownPos.current = { x: e.clientX, y: e.clientY, id: inst.id };
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
                                if (e.key !== "Enter" && e.key !== " ") return;
                                if (e.key === " ") e.preventDefault();
                                const down = pointerDownPos.current;
                                if (down && down.id !== inst.id) return;
                                e.stopPropagation();
                                onBlockClick(inst);
                              }
                            : undefined
                        }
                        role={onBlockClick ? "button" : undefined}
                        tabIndex={onBlockClick ? 0 : undefined}
                        className={`absolute rounded-md overflow-hidden p-1.5 text-[11px] leading-snug bg-white border-2 border-primary/50 text-foreground shadow-sm hover:border-primary/80 hover:shadow transition-all select-none ${draggable ? "cursor-grab active:cursor-grabbing" : onBlockClick ? "cursor-pointer" : "cursor-default"}`}
                        style={{
                          top: topPx + 1,
                          height: Math.max(heightPx - 2, 18),
                          left: `${leftPct + 0.5}%`,
                          width: `${widthPct - 1}%`,
                          ...(blockColor?.(inst)
                            ? {
                                borderColor: blockColor(inst)!,
                                backgroundColor: blockColor(inst)! + "18",
                              }
                            : {
                                borderColor: "#9ca3af",
                                backgroundColor: "#9ca3af18",
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
                            className="absolute top-0.5 right-0.5 flex items-center justify-center w-5 h-5 rounded bg-black/10 text-xs font-bold leading-none text-foreground hover:bg-black/25 transition-colors cursor-pointer"
                            aria-label="Edit"
                          >
                            ···
                          </button>
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
    </div>
  );
}