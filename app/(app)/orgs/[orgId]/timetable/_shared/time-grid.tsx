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

interface TimeGridProps<TInstance extends GridInstance, TColumnKey extends string> {
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

  /** Whether blocks should be draggable (move). */
  draggable?: boolean;

  /** Minutes-from-midnight to auto-scroll to on mount/column-set change. */
  initialScrollMin?: number;

  fillHeight?: boolean;

  /** Extra CSS class applied to a column when it is "today" or otherwise highlighted. */
  columnHighlightClass?: (column: TColumnKey) => string | undefined;
}

/**
 * The core 24-hour scrollable time grid.
 * Renders hour gutters, day/cycle columns, drag-drop, and block layout.
 * Column headers and block content are fully customisable via render props
 * so this component knows nothing about dates vs template day indices,
 * or status vs no-status entries.
 */
export function TimeGrid<TInstance extends GridInstance, TColumnKey extends string>({
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
  draggable = true,
  initialScrollMin = 0,
  fillHeight,
  columnHighlightClass,
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
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollTo = Math.max(0, Math.floor(initialScrollMin / 60) * HOUR_HEIGHT - HOUR_HEIGHT / 2);
    scrollRef.current.scrollTop = scrollTo;
    // Intentionally only runs when the column set changes (week/page nav)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join(",")]);

  function handleColumnDragOver(e: React.DragEvent<HTMLDivElement>, col: TColumnKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragDataRef.current?.type === "move" ? "move" : "copy";
    const offsetMin = dragDataRef.current?.type === "move" ? dragDataRef.current.offsetMin : 0;
    onDragOver(col, calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin));
  }

  function handleColumnDrop(e: React.DragEvent<HTMLDivElement>, col: TColumnKey) {
    e.preventDefault();
    const data = dragDataRef.current;
    dragDataRef.current = null;
    if (!data) return;
    const offsetMin = data.type === "move" ? data.offsetMin : 0;
    onDrop(col, calcDropTimeMin(e.clientY, e.currentTarget, 0, offsetMin), data);
  }

  return (
    <div className={`rounded-xl border border-border overflow-hidden${fillHeight ? " flex flex-col flex-1 min-h-0" : ""}`}>
      {/* Column headers */}
      <div className="flex border-b border-border bg-muted/50">
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
        className={fillHeight ? "overflow-y-auto bg-background flex-1 min-h-0" : "overflow-y-auto bg-background"}
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
                className={`flex-1 relative border-r border-border last:border-r-0 transition-colors ${highlightClass ? "bg-muted/30" : ""} ${isDragTarget ? "bg-primary/5" : ""}`}
                style={{ height: totalHeight }}
                onDragOver={(e) => handleColumnDragOver(e, col)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeave();
                }}
                onDrop={(e) => handleColumnDrop(e, col)}
              >
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
                {positioned.map(({ instance: inst, col: colSlot, totalCols }) => {
                  const topPx = (inst.startTimeMin / 60) * HOUR_HEIGHT;
                  const heightPx = Math.max((inst.task.durationMin / 60) * HOUR_HEIGHT, 20);
                  const widthPct = 100 / totalCols;
                  const leftPct = colSlot * widthPct;

                  return (
                    <div
                      key={inst.id}
                      draggable={draggable}
                      onDragStart={draggable ? (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragDataRef.current = {
                          type: "move",
                          instanceId: inst.id,
                          offsetMin: ((e.clientY - rect.top) / HOUR_HEIGHT) * 60,
                        };
                        e.dataTransfer.effectAllowed = "move";
                      } : undefined}
                      onDragEnd={draggable ? () => { dragDataRef.current = null; onDragLeave(); } : undefined}
                      className={`absolute rounded border overflow-hidden p-1.5 text-[11px] leading-snug bg-white text-foreground border-gray-300 hover:opacity-90 transition-opacity select-none ${draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                      style={{
                        top: topPx + 1,
                        height: Math.max(heightPx - 2, 18),
                        left: `${leftPct + 0.5}%`,
                        width: `${widthPct - 1}%`,
                      }}
                    >
                      {renderBlock(inst, heightPx)}
                      {onBlockMenuClick && (
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onBlockMenuClick(inst); }}
                          className="absolute top-0.5 right-0.5 flex items-center justify-center w-5 h-5 rounded bg-black/10 text-xs font-bold leading-none text-foreground hover:bg-black/25 transition-colors cursor-pointer"
                          aria-label="Edit"
                        >
                          ···
                        </button>
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
  );
}
