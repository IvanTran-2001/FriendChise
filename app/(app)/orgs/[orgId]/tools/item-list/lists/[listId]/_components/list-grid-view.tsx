"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { cn } from "@/lib/utils";
import { updateToolItemListEntryAmountAction } from "@/app/actions/tools";
import type { ListDetail } from "./list-detail-client";
import type { ConversionRate } from "./item-rates-panel";

interface ListGridViewProps {
  orgId: string;
  listId: string;
  list: ListDetail;
  canManage?: boolean;
  onCellClick?: (position: number) => void;
  onSwap?: (fromPosition: number, toPosition: number) => void;
  onDropNewItem?: (itemId: string, position: number) => void;
  activeSetRates?: ConversionRate[];
  hiddenRateIds?: Set<string>;
  showAmount?: boolean;
  showRates?: boolean;
  onItemClick?: (entry: { entryId: string; item: { id: string; name: string; unit: string }; position: number }) => void;
}

export function ListGridView({
  orgId,
  listId,
  list,
  canManage,
  onCellClick,
  onSwap,
  onDropNewItem,
  activeSetRates,
  hiddenRateIds,
  showAmount = true,
  showRates = false,
  onItemClick,
}: ListGridViewProps) {
  const cols = list.gridConfig?.gridCols ?? 4;
  const rows = list.gridConfig?.gridRows ?? 4;
  const [page, setPage] = useState(0);
  const [dragFromPos, setDragFromPos] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<number | null>(null);
  const [externalDragTargetPos, setExternalDragTargetPos] = useState<number | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [_isPending, startTransition] = useTransition();

  const pageSize = cols * rows;

  // Map position → entry for O(1) cell lookup
  const entriesByPosition = new Map(list.entries.map((e) => [e.position, e]));

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
    <div className="flex flex-col flex-1 min-h-0 gap-2 -mt-2 sm:-mt-4">
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

      {/* Grid cells */}
      <div
        className="flex-1 min-h-0 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {Array.from({ length: pageSize }, (_, i) => {
          const absPos = pageStart + i;
          const entry = entriesByPosition.get(absPos) ?? null;
          const isDragSource = dragFromPos === absPos;
          const isDragTarget =
            dragOverPos === absPos &&
            dragFromPos !== null &&
            dragFromPos !== absPos;
          const isEditingThisAmount =
            entry && editingEntryId === entry.id;

          return (
            <div
              key={absPos}
              draggable={!!entry && !!canManage && !isEditingThisAmount}
              onDragStart={
                entry && !isEditingThisAmount
                  ? () => setDragFromPos(absPos)
                  : undefined
              }
              onDragEnd={() => {
                setDragFromPos(null);
                setDragOverPos(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragFromPos !== null) {
                  setDragOverPos(absPos);
                } else if (
                  e.dataTransfer.types.includes("application/new-item-id") &&
                  !entry
                ) {
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
                  onSwap?.(dragFromPos, absPos);
                  setDragFromPos(null);
                  return;
                }
                const newItemId = e.dataTransfer.getData("application/new-item-id");
                if (newItemId && !entry) {
                  onDropNewItem?.(newItemId, absPos);
                }
                setDragFromPos(null);
              }}
              onClick={() => {
                if (isEditingThisAmount) return;
                if (!entry && canManage) {
                  onCellClick?.(absPos);
                } else if (entry && onItemClick) {
                  onItemClick({ entryId: entry.id, item: entry.item, position: entry.position });
                }
              }}
              className={cn(
                "rounded-lg border flex flex-col overflow-hidden transition-all select-none",
                entry
                  ? [
                      "bg-card",
                      canManage && !isEditingThisAmount && "cursor-grab active:cursor-grabbing",
                      onItemClick && !isEditingThisAmount && "cursor-pointer",
                    ]
                  : [
                      "bg-muted/20 border-dashed border-border/60",
                      canManage && "cursor-pointer hover:bg-primary/5 hover:border-primary/30",
                    ],
                isDragSource && "opacity-40 scale-95",
                isDragTarget && "ring-2 ring-primary ring-offset-1 bg-primary/5",
                externalDragTargetPos === absPos && "ring-2 ring-green-500 ring-offset-1 bg-green-500/5",
              )}
            >
              {entry ? (
                <>
                  <div className="flex-1 min-h-0 bg-muted relative">
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
                  <div className="px-2 py-1.5 shrink-0 border-t border-border">
                    <p className="text-xs font-medium truncate leading-tight">
                      {entry.item.name}
                    </p>
                    {(showAmount || isEditingThisAmount) && (
                      isEditingThisAmount ? (
                        <div
                          className="flex items-center gap-1 mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            step="any"
                            value={editingAmount}
                            onChange={(e) => setEditingAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitAmount(entry);
                              if (e.key === "Escape") setEditingEntryId(null);
                            }}
                            onBlur={() => commitAmount(entry)}
                            className="w-full text-xs bg-transparent border-b border-primary outline-none leading-tight tabular-nums py-0"
                          />
                          <span className="text-xs text-muted-foreground shrink-0 leading-tight">
                            {entry.item.unit}
                          </span>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "text-xs text-muted-foreground leading-tight",
                            canManage && "cursor-text hover:text-foreground transition-colors",
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
                          {entry.amount} {entry.item.unit}
                        </p>
                      )
                    )}
                  </div>
                  {(() => {
                    if (!showRates || !activeSetRates) return null;
                    const cellRates = activeSetRates.filter(
                      (r) =>
                        (r.toItem.id === entry.item.id || r.fromItem.id === entry.item.id) &&
                        !hiddenRateIds?.has(r.id),
                    );
                    if (cellRates.length === 0) return null;
                    return (
                      <div className="px-2 pb-1.5 flex flex-col gap-0 border-t border-border/40">
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
                              className="text-[10px] leading-tight tabular-nums text-muted-foreground/70 truncate"
                            >
                              {otherItem.name}: {qty}{otherItem.unit}
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
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  {canManage && (
                    <Plus className="h-5 w-5 text-muted-foreground/25" />
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

