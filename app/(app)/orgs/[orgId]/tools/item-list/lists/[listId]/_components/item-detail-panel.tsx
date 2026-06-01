"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  moveToolItemListEntryAction,
  removeToolItemListEntryAction,
} from "@/app/actions/tools";
import type { ConversionRate } from "./item-rates-panel";

function formatMultiplier(toQty: number, fromQty: number): string {
  const m = toQty / fromQty;
  if (Number.isInteger(m)) return m.toString();
  if (m >= 10) return m.toFixed(1);
  if (m >= 1) return m.toFixed(2);
  return m.toFixed(3);
}

interface ItemDetailPanelProps {
  orgId: string;
  listId: string;
  entryId: string;
  item: { id: string; name: string; unit: string; imageSignedUrl: string | null };
  position: number;
  subIndex: number;
  totalInCell: number;
  gridCols: number;
  gridRows: number;
  canManage: boolean;
  rates: ConversionRate[];
  setName: string | null;
  hiddenRateIds: Set<string>;
  onToggleRate: (rateId: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  onClose: () => void;
}

export function ItemDetailPanel({
  orgId,
  listId,
  entryId,
  item,
  position,
  subIndex,
  totalInCell,
  gridCols,
  gridRows,
  canManage,
  rates,
  setName,
  hiddenRateIds: initialHidden,
  onToggleRate,
  onNavigate,
  onClose,
}: ItemDetailPanelProps) {
  const pageSize = gridCols * gridRows;
  const initPage = Math.floor(position / pageSize) + 1;
  const posInPage = position % pageSize;
  const initRow = Math.floor(posInPage / gridCols) + 1;
  const initCol = (posInPage % gridCols) + 1;

  const [pageVal, setPageVal] = useState(String(initPage));
  const [colVal, setColVal] = useState(String(initCol));
  const [rowVal, setRowVal] = useState(String(initRow));
  const [hiddenIds, setHiddenIds] = useState(new Set(initialHidden));
  const [search, setSearch] = useState("");
  const [isMovePending, startMoveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  const parsedPage = parseInt(pageVal);
  const parsedCol = parseInt(colVal);
  const parsedRow = parseInt(rowVal);
  const newPos =
    !isNaN(parsedPage) && !isNaN(parsedCol) && !isNaN(parsedRow)
      ? (parsedPage - 1) * pageSize + (parsedRow - 1) * gridCols + (parsedCol - 1)
      : -1;
  const posChanged = newPos >= 0 && newPos !== position;

  function handleMove() {
    if (!posChanged) return;
    startMoveTransition(async () => {
      const result = await moveToolItemListEntryAction(orgId, listId, position, newPos);
      if (!result.ok) { toast.error("Failed to move item."); return; }
      toast.success("Item moved.");
      onClose();
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await removeToolItemListEntryAction(orgId, listId, entryId);
      if (!result.ok) { toast.error("Failed to remove item."); return; }
      toast.success(`"${item.name}" removed.`);
      onClose();
    });
  }

  const relevantRates = rates.filter(
    (r) => r.toItem.id === item.id || r.fromItem.id === item.id,
  );
  const filteredRates = relevantRates.filter((r) => {
    if (!search.trim()) return true;
    const isToItem = r.toItem.id === item.id;
    const otherName = isToItem ? r.fromItem.name : r.toItem.name;
    return otherName.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Hero: image + name + unit + stack position */}
      <div className="flex flex-col border-b border-border">
        {/* Image */}
        <div className="relative w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
          {item.imageSignedUrl ? (
            <Image
              src={item.imageSignedUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="300px"
            />
          ) : (
            <span className="text-5xl font-semibold text-muted-foreground/20 uppercase select-none">
              {item.name.charAt(0)}
            </span>
          )}
          {/* Stack nav overlay — only shown when cell has multiple items */}
          {totalInCell > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 py-1.5 bg-linear-to-t from-black/60 to-transparent">
              <button
                className={cn(
                  "rounded p-1 text-white transition-opacity",
                  subIndex === 0 ? "opacity-20 pointer-events-none" : "hover:bg-white/20",
                )}
                aria-label="Previous item in cell"
                disabled={subIndex === 0}
                onClick={() => onNavigate?.("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-white/80 text-xs tabular-nums font-medium">
                {subIndex + 1} / {totalInCell}
              </span>
              <button
                className={cn(
                  "rounded p-1 text-white transition-opacity",
                  subIndex >= totalInCell - 1 ? "opacity-20 pointer-events-none" : "hover:bg-white/20",
                )}
                aria-label="Next item in cell"
                disabled={subIndex >= totalInCell - 1}
                onClick={() => onNavigate?.("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {/* Name + unit */}
        <div className="px-4 py-3">
          <p className="text-base font-semibold leading-tight">{item.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.unit}</p>
        </div>
      </div>

      {/* Position + actions */}
      {canManage && (
        <div className="px-4 pt-3 pb-3 border-b border-border flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Position</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Page</label>
              <Input
                type="number"
                min="1"
                value={pageVal}
                onChange={(e) => setPageVal(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Col</label>
              <Input
                type="number"
                min="1"
                max={gridCols}
                value={colVal}
                onChange={(e) => setColVal(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Row</label>
              <Input
                type="number"
                min="1"
                max={gridRows}
                value={rowVal}
                onChange={(e) => setRowVal(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={!posChanged || isMovePending}
              onClick={handleMove}
            >
              Move
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isDeletePending}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Rates */}
      {setName && relevantRates.length > 0 && (
        <>
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs text-muted-foreground/60">
              Rates · {setName}
            </p>
          </div>

          {relevantRates.length > 3 && (
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter rates…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filteredRates.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">No matches.</p>
              </div>
            ) : (
              <div className="py-1">
                {filteredRates.map((rate) => {
                  const hidden = hiddenIds.has(rate.id);
                  const isToItem = rate.toItem.id === item.id;
                  const otherItem = isToItem ? rate.fromItem : rate.toItem;
                  const multiplier = isToItem
                    ? formatMultiplier(rate.fromQty, rate.toQty)
                    : formatMultiplier(rate.toQty, rate.fromQty);
                  return (
                    <div
                      key={rate.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-opacity",
                        hidden && "opacity-40",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate transition-all",
                            hidden && "line-through text-muted-foreground",
                          )}
                        >
                          {otherItem.name}
                        </p>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground tabular-nums",
                            hidden && "line-through",
                          )}
                        >
                          {multiplier} {otherItem.unit}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          const next = new Set(hiddenIds);
                          if (next.has(rate.id)) next.delete(rate.id);
                          else next.add(rate.id);
                          setHiddenIds(next);
                          onToggleRate(rate.id);
                        }}
                        aria-label={hidden ? "Show rate" : "Hide rate"}
                      >
                        {hidden ? (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state when no rates and can't manage */}
      {!canManage && (!setName || relevantRates.length === 0) && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No rates for this item.</p>
        </div>
      )}
    </div>
  );
}
