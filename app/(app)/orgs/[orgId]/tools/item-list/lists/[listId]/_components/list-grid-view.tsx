"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSupportsHover } from "@/hooks/use-hover-capability";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { cn } from "@/lib/utils";
import { updateToolItemListEntryAmountAction } from "@/app/actions/tools";
import type { ListDetail } from "./list-detail-client";
import type { ConversionRate } from "./item-rates-panel";

/** Returns uppercase initials for a name, e.g. "Apple Crumble" → "AC". */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("");
}

interface ListGridViewProps {
  orgId: string;
  listId: string;
  list: ListDetail;
  canManage?: boolean;
  /** Called when an empty cell is clicked — opens the Add Item panel pre-filled to that position. */
  onCellClick?: (position: number) => void;
  /** Called when an existing entry is dragged to a new cell. Replaces the old onSwap (which swapped two cells); this just moves the entry by ID, allowing stacking. */
  onMoveEntry?: (entryId: string, fromPosition: number, toPosition: number) => void;
  onDropNewItem?: (itemId: string, position: number) => void;
  activeSetRates?: ConversionRate[];
  hiddenRateIds?: Set<string>;
  showAmount?: boolean;
  showRates?: boolean;
  /** Absolute position (0-indexed) of the cell to highlight — driven by the open action panel so users can see which cell they're editing. */
  highlightedPosition?: number;
  onItemClick?: (entry: { entryId: string; item: { id: string; name: string; unit: string; imageSignedUrl: string | null }; position: number; subIndex: number; totalInCell: number }) => void;
  /** Called when prev/next arrows cycle through stacked items in a cell, so parent can update the open sidebar. */
  onSubIndexChange?: (entry: { entryId: string; item: { id: string; name: string; unit: string; imageSignedUrl: string | null }; position: number; subIndex: number; totalInCell: number }) => void;
  /** When true, all cells (including occupied) fire onCellClick — used for pending item placement. */
  placementMode?: boolean;
}

export function ListGridView({
  orgId,
  listId,
  list,
  canManage,
  onCellClick,
  onMoveEntry,
  onDropNewItem,
  activeSetRates,
  hiddenRateIds,
  showAmount = true,
  showRates: _showRates = false,
  highlightedPosition,
  onItemClick,
  onSubIndexChange,
  placementMode,
}: ListGridViewProps) {
  const supportsHover = useSupportsHover();
  const cols = list.gridConfig?.gridCols ?? 4;
  const rows = list.gridConfig?.gridRows ?? 4;
  const pageSize = cols * rows;
  const [page, setPage] = useState(0);
  const [dragFromPos, setDragFromPos] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<number | null>(null);
  const [externalDragTargetPos, setExternalDragTargetPos] = useState<number | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  // Per-cell sub-item index — tracks which stacked item is visible per cell
  const [cellSubIndex, setCellSubIndex] = useState<Map<number, number>>(new Map());
  const swipeGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const swipeAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [swipeAnimation, setSwipeAnimation] = useState<{
    pos: number;
    direction: "prev" | "next";
  } | null>(null);

  // Detect when CSS auto-fill wraps to fewer columns than configured
  const gridRef = useRef<HTMLDivElement>(null);
  const [isWrapped, setIsWrapped] = useState(false);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const MIN_CELL_PX = 128; // 8rem at 16px base
    const GAP_PX = 8;        // 0.5rem gap
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const actualCols = Math.floor((width + GAP_PX) / (MIN_CELL_PX + GAP_PX));
      setIsWrapped(actualCols < cols);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cols]);
  function getCellSub(pos: number) { return cellSubIndex.get(pos) ?? 0; }
  function setCellSub(pos: number, idx: number) {
    setCellSubIndex((prev) => new Map(prev).set(pos, idx));
  }
  function syncCellSubIndex(
    pos: number,
    cellEntries: typeof list.entries,
    nextIdx: number,
    direction: "prev" | "next" = "next",
  ) {
    const clamped = Math.max(0, Math.min(nextIdx, cellEntries.length - 1));
    if (clamped !== nextIdx) return;
    setCellSub(pos, clamped);
    setSwipeAnimation({ pos, direction });
    if (swipeAnimationTimeoutRef.current !== null) {
      clearTimeout(swipeAnimationTimeoutRef.current);
    }
    swipeAnimationTimeoutRef.current = setTimeout(() => {
      setSwipeAnimation(null);
      swipeAnimationTimeoutRef.current = null;
    }, 180);
    const newEntry = cellEntries[clamped];
    if (newEntry) {
      onSubIndexChange?.({
        entryId: newEntry.id,
        item: { ...newEntry.item },
        position: newEntry.position,
        subIndex: clamped,
        totalInCell: cellEntries.length,
      });
    }
  }

  useEffect(
    () => () => {
      if (swipeAnimationTimeoutRef.current !== null) {
        clearTimeout(swipeAnimationTimeoutRef.current);
      }
    },
    [],
  );

  // Adjusting state during render (React official pattern) — auto-navigate to the
  // highlighted cell's page when highlightedPosition changes, without blocking navigation.
  const [lastSeenHighlight, setLastSeenHighlight] = useState<number | undefined>(undefined);
  if (highlightedPosition !== lastSeenHighlight) {
    setLastSeenHighlight(highlightedPosition);
    if (highlightedPosition !== undefined) {
      const targetPage = Math.floor(highlightedPosition / pageSize);
      if (page !== targetPage) setPage(targetPage);
    }
  }

  // Group entries by position so a cell can hold multiple items
  const entriesAtPosition = list.entries.reduce<Map<number, typeof list.entries>>(
    (acc, e) => {
      const arr = acc.get(e.position) ?? [];
      arr.push(e);
      acc.set(e.position, arr);
      return acc;
    },
    new Map(),
  );

  const pageStart = page * pageSize;

  // Which pages have at least one item
  const pagesWithItems = new Set(list.entries.map((e) => Math.floor(e.position / pageSize)));
  const lastOccupiedPage = pagesWithItems.size > 0 ? Math.max(...pagesWithItems) : -1;

  function startEditingAmount(entry: ListDetail["entries"][number]) {
    setEditingEntryId(entry.id);
    setEditingAmount(String(entry.amount));
  }

  function commitAmount(entry: ListDetail["entries"][number]) {
    setEditingEntryId(null);
    const parsed = parseFloat(editingAmount);
    if (isNaN(parsed) || parsed === entry.amount) return;
    startTransition(async () => {
      const result = await updateToolItemListEntryAmountAction(
        orgId,
        listId,
        entry.id,
        parsed,
      );
      if (!result.ok) toast.error("Failed to update amount.");
    });
  }

  return (
    <div className="flex flex-col gap-2 -mt-2 sm:-mt-4">
      {/* Toolbar */}
      <RegisterPageToolbar>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums px-1">
            Page {page + 1}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={page > lastOccupiedPage}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

        </div>
      </RegisterPageToolbar>

      {/* Page dot indicators */}
      {lastOccupiedPage >= 0 && (
        <div className="shrink-0 flex items-center justify-center gap-1.5">
          {Array.from({ length: lastOccupiedPage + 1 }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={cn(
                "rounded-full transition-all",
                i === page
                  ? "w-2 h-2 bg-foreground"
                  : pagesWithItems.has(i)
                  ? "w-1.5 h-1.5 bg-muted-foreground/60 hover:bg-muted-foreground"
                  : "w-1.5 h-1.5 bg-border hover:bg-muted-foreground/40",
              )}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Grid — `auto-fill` columns sized with clamp so:
           - At full width: exactly `cols` equal columns fill the row
           - Below min threshold (8rem per cell): fewer columns wrap to next row */}
      <div
        ref={gridRef}
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(clamp(8rem, calc((100% - ${cols - 1} * 0.5rem) / ${cols}), 100%), 1fr))`,
        }}
      >
        {Array.from({ length: pageSize }, (_, i) => {
          const absPos = pageStart + i;
          const cellEntries = entriesAtPosition.get(absPos) ?? [];
          const subIdx = Math.min(getCellSub(absPos), Math.max(0, cellEntries.length - 1));
          const entry = cellEntries[subIdx] ?? null;
          const hasMultiple = cellEntries.length > 1;
          const isDragSource = dragFromPos === absPos;
          const isDragTarget =
            dragOverPos === absPos &&
            dragFromPos !== null &&
            dragFromPos !== absPos;
          const isEditingThisAmount =
            entry && editingEntryId === entry.id;
          const canDragEntry = !!entry && !!canManage && !isEditingThisAmount && !placementMode && supportsHover;
          const canCycleStack = !!entry && hasMultiple && !isEditingThisAmount && !placementMode && !supportsHover;

          return (
            <div
              key={absPos}
              draggable={canDragEntry}
              onDragStart={
                canDragEntry
                  ? () => setDragFromPos(absPos)
                  : undefined
              }
              onDragEnd={() => {
                setDragFromPos(null);
                setDragOverPos(null);
              }}
              onPointerDown={(e) => {
                if (!canCycleStack || e.button !== 0) return;
                suppressClickRef.current = false;
                swipeGestureRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                };
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore capture failures on browsers that do not support it here.
                }
              }}
              onPointerMove={(e) => {
                const gesture = swipeGestureRef.current;
                if (!canCycleStack || !gesture || gesture.pointerId !== e.pointerId) return;
                const dx = e.clientX - gesture.startX;
                const dy = e.clientY - gesture.startY;
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                if (Math.abs(dx) <= Math.abs(dy)) return;
                e.preventDefault();
              }}
              onPointerUp={(e) => {
                const gesture = swipeGestureRef.current;
                if (!gesture || gesture.pointerId !== e.pointerId) return;
                const dx = e.clientX - gesture.startX;
                const dy = e.clientY - gesture.startY;
                const shouldCycle = Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy) * 1.2;
                if (shouldCycle) {
                  suppressClickRef.current = true;
                  const direction = dx < 0 ? 1 : -1;
                  syncCellSubIndex(absPos, cellEntries, subIdx + direction, direction < 0 ? "prev" : "next");
                }
                swipeGestureRef.current = null;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore capture release failures.
                }
              }}
              onPointerCancel={(e) => {
                const gesture = swipeGestureRef.current;
                if (!gesture || gesture.pointerId !== e.pointerId) return;
                swipeGestureRef.current = null;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore capture release failures.
                }
              }}
              onWheel={(e) => {
                if (!canCycleStack) return;
                const horizontalDelta =
                  Math.abs(e.deltaX) >= Math.abs(e.deltaY)
                    ? e.deltaX
                    : e.shiftKey
                      ? e.deltaY
                      : 0;
                if (Math.abs(horizontalDelta) < 8) return;
                e.preventDefault();
                const direction = horizontalDelta < 0 ? 1 : -1;
                syncCellSubIndex(absPos, cellEntries, subIdx + direction, direction < 0 ? "prev" : "next");
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragFromPos !== null) {
                  setDragOverPos(absPos);
                } else if (e.dataTransfer.types.includes("application/new-item-id")) {
                  // Allow drop onto any cell — occupied cells stack the new item
                  e.dataTransfer.dropEffect = "copy";
                  setExternalDragTargetPos(absPos);
                } else {
                  e.dataTransfer.dropEffect = "none";
                }
              }}
              onDragLeave={() => {
                setDragOverPos(null);
                setExternalDragTargetPos(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverPos(null);
                setExternalDragTargetPos(null);
                if (dragFromPos !== null && dragFromPos !== absPos) {
                  // Move the currently visible entry at dragFromPos to absPos
                  const fromEntries = entriesAtPosition.get(dragFromPos) ?? [];
                  const fromSub = getCellSub(dragFromPos);
                  const fromEntry = fromEntries[Math.min(fromSub, fromEntries.length - 1)];
                  if (fromEntry) {
                    onMoveEntry?.(fromEntry.id, dragFromPos, absPos);
                  }
                  setDragFromPos(null);
                  return;
                }
                const newItemId = e.dataTransfer.getData("application/new-item-id");
                if (newItemId) {
                  // Stack onto any cell (occupied or empty)
                  onDropNewItem?.(newItemId, absPos);
                }
                setDragFromPos(null);
              }}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (isEditingThisAmount) return;
                if (placementMode) {
                  onCellClick?.(absPos);
                  return;
                }
                if (!entry && canManage) {
                  onCellClick?.(absPos);
                } else if (entry && onItemClick) {
                  onItemClick({ entryId: entry.id, item: { ...entry.item }, position: entry.position, subIndex: subIdx, totalInCell: cellEntries.length });
                }
              }}
              style={{
                aspectRatio: "1 / 1",
                touchAction: canCycleStack ? "pan-y" : undefined,
              }}
              className={cn(
                "relative group @container/cell rounded-lg border flex flex-col overflow-hidden transition-all select-none",
                placementMode
                  ? [
                      "cursor-pointer",
                      entry
                        ? "bg-sky-50/70 border-sky-200/70 hover:bg-sky-100/80 hover:ring-2 hover:ring-sky-500/60 hover:ring-offset-1"
                        : "bg-sky-50/60 border-sky-200/70 hover:bg-sky-100/90 hover:ring-2 hover:ring-sky-500/70 hover:ring-offset-1",
                    ]
                  : entry
                  ? [
                      "bg-card",
                        canDragEntry && "cursor-grab active:cursor-grabbing",
                      onItemClick && !isEditingThisAmount && "cursor-pointer",
                    ]
                  : [
                      "bg-muted/20 border-dashed border-border/60",
                      canManage && "cursor-pointer hover:bg-primary/5 hover:border-primary/30",
                    ],
                isDragSource && "opacity-40 scale-95",
                externalDragTargetPos === absPos && "ring-2 ring-green-500 ring-offset-1 bg-green-500/5",
                highlightedPosition === absPos && !isDragTarget && !isDragSource && "ring-2 ring-sky-500 ring-offset-1 bg-sky-100/80 border-sky-400",
                canCycleStack && "touch-pan-y",
              )}
            >
              {entry ? (
                <div
                  className="flex h-full min-h-0 flex-col"
                  style={
                    swipeAnimation?.pos === absPos
                      ? {
                          animation:
                            swipeAnimation.direction === "next"
                              ? "list-swipe-next 180ms ease-out both"
                              : "list-swipe-prev 180ms ease-out both",
                        }
                      : undefined
                  }
                >
                  {/* Row/Col badge — bottom-left, shown when grid is narrower than configured */}
                  {isWrapped && (
                    <div className="absolute top-1 left-1 z-20 bg-background/80 backdrop-blur-sm text-[8px] font-medium px-1 py-0.5 rounded leading-none border border-border/50 text-muted-foreground pointer-events-none tabular-nums">
                      R{Math.floor(i / cols) + 1} C{(i % cols) + 1}
                    </div>
                  )}
                  {/* Stack badge — "current/total" top-right, shown when >1 item */}
                  {hasMultiple && (
                    <div className="absolute top-1 right-1 z-20 bg-background/90 backdrop-blur-sm text-[9px] font-medium px-1 py-0.5 rounded leading-none border border-border/60 pointer-events-none">
                      {subIdx + 1}/{cellEntries.length}
                    </div>
                  )}
                  {/* Prev arrow — always visible on touch/mobile, hover-only on desktop */}
                  {hasMultiple && subIdx > 0 && (
                    <button
                      className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background rounded-r p-0.5 transition-opacity ${supportsHover ? "invisible group-hover:visible" : "visible"}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={(e) => {
                        e.stopPropagation();
                        syncCellSubIndex(absPos, cellEntries, subIdx - 1, "prev");
                      }}
                      aria-label="Previous item"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                  )}
                  {/* Next arrow — always visible on touch/mobile, hover-only on desktop */}
                  {hasMultiple && subIdx < cellEntries.length - 1 && (
                    <button
                      className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background rounded-l p-0.5 transition-opacity ${supportsHover ? "invisible group-hover:visible" : "visible"}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={(e) => {
                        e.stopPropagation();
                        syncCellSubIndex(absPos, cellEntries, subIdx + 1);
                      }}
                      aria-label="Next item"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                  {/* Image area — takes remaining height after info divs, image is a square
                      sized by available height but capped by cell width */}
                  <div className="flex-1 min-h-0 bg-muted flex items-center justify-center overflow-hidden">
                    <div className="relative h-full aspect-square max-w-full overflow-hidden">
                      {entry.item.imageSignedUrl ? (
                        <Image
                          src={entry.item.imageSignedUrl}
                          alt={entry.item.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-semibold text-muted-foreground/40 uppercase select-none">
                            {entry.item.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-1.5 py-1 shrink-0 border-t border-border flex flex-col gap-0.5">
                    {/* Name: full text at ≥6rem container width, initials below */}
                    <p className="text-[10px] font-medium leading-tight">
                      <span className="hidden @[6rem]/cell:inline line-clamp-2">{entry.item.name}</span>
                      <span className="inline @[6rem]/cell:hidden">{getInitials(entry.item.name)}</span>
                    </p>
                    {/* Amount — number is shrink-0 so it always shows; unit truncates */}
                    {(showAmount || isEditingThisAmount) && (
                      isEditingThisAmount ? (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            isPending && "opacity-70",
                          )}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            step="any"
                            value={editingAmount}
                            disabled={isPending}
                            onChange={(e) => setEditingAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitAmount(entry);
                              if (e.key === "Escape") setEditingEntryId(null);
                            }}
                            onBlur={() => commitAmount(entry)}
                            className="w-full rounded-md border border-primary/30 bg-background/90 px-1 py-0.5 text-[10px] leading-tight tabular-nums outline-none shadow-sm focus:border-primary"
                          />
                          <span className="text-[10px] text-muted-foreground shrink-0 leading-tight">
                            {entry.item.unit}
                          </span>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "text-[10px] text-muted-foreground leading-tight flex items-baseline gap-1",
                            canManage && "cursor-pointer hover:text-foreground transition-colors",
                          )}
                          onClick={
                            canManage
                              ? (e) => {
                                  e.stopPropagation();
                                  startEditingAmount(entry);
                                }
                              : undefined
                          }
                        >
                          {canManage && (
                            <span className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/80 p-0.5 text-muted-foreground">
                              <Pencil className="h-2.5 w-2.5" />
                            </span>
                          )}
                          {/* Number always visible; unit hides at narrow sizes */}
                          <span className="shrink-0 tabular-nums">{entry.amount}</span>
                          <span className="hidden @[7rem]/cell:inline truncate">{entry.item.unit}</span>
                          {canManage && (
                            <span className="hidden @[8rem]/cell:inline text-[9px] text-muted-foreground/70">
                              edit
                            </span>
                          )}
                        </p>
                      )
                    )}
                    {/* Rates — always rendered when activeSetRates provided */}
                    {activeSetRates && (() => {
                      const cellRates = activeSetRates.filter(
                        (r) =>
                          (r.toItem.id === entry.item.id || r.fromItem.id === entry.item.id) &&
                          !hiddenRateIds?.has(r.id),
                      );
                      if (cellRates.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-0 border-t border-border/40 pt-0.5 mt-0.5">
                          {cellRates.slice(0, 2).map((rate) => {
                            const isToItem = rate.toItem.id === entry.item.id;
                            const otherItem = isToItem ? rate.fromItem : rate.toItem;
                            const ratio = isToItem
                              ? rate.fromQty / rate.toQty
                              : rate.toQty / rate.fromQty;
                            const qty =
                              ratio === 0
                                ? "0"
                                : Number.isInteger(ratio)
                                  ? `${ratio}`
                                  : ratio >= 100
                                    ? ratio.toFixed(0)
                                    : ratio >= 10
                                      ? ratio.toFixed(1)
                                      : ratio >= 1
                                        ? ratio.toFixed(2)
                                        : ratio.toFixed(3);
                            return (
                              <p
                                key={rate.id}
                                className="text-[10px] leading-tight tabular-nums text-muted-foreground/70 flex items-baseline gap-0.5"
                              >
                                {/* Number always visible; unit hides narrow; (name) hides narrower */}
                                <span className="shrink-0 tabular-nums">{qty}</span>
                                <span className="hidden @[7rem]/cell:inline shrink-0">{otherItem.unit}</span>
                                <span className="hidden @[8.5rem]/cell:inline text-muted-foreground/40 truncate">({otherItem.name})</span>
                              </p>
                            );
                          })}
                          {cellRates.length > 2 && (
                            <p className="text-[10px] text-muted-foreground/40">
                              +{cellRates.length - 2} more
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  {canManage && (
                    <Plus className="h-5 w-5 text-muted-foreground/25" />
                  )}
                  {isWrapped && (
                    <div className="absolute top-1 left-1 z-20 bg-background/80 backdrop-blur-sm text-[8px] font-medium px-1 py-0.5 rounded leading-none border border-border/50 text-muted-foreground pointer-events-none tabular-nums">
                      R{Math.floor(i / cols) + 1} C{(i % cols) + 1}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>


    </div>
  );
}

