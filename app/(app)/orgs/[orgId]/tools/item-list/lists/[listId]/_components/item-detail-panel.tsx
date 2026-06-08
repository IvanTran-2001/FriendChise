"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  moveToolItemListEntryAction,
  removeToolItemListEntryAction,
  updateToolItemListEntryAmountAction,
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
  amount: number;
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
  amount: initialAmount,
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
  const [amountVal, setAmountVal] = useState(String(initialAmount));
  const [hiddenIds, setHiddenIds] = useState(new Set(initialHidden));
  const [search, setSearch] = useState("");
  const [isMovePending, startMoveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isAmountPending, startAmountTransition] = useTransition();

  const parsedPage = Number.parseInt(pageVal);
  const parsedCol = Number.parseInt(colVal);
  const parsedRow = Number.parseInt(rowVal);
  const newPos =
    !Number.isNaN(parsedPage) &&
    !Number.isNaN(parsedCol) &&
    !Number.isNaN(parsedRow)
      ? (parsedPage - 1) * pageSize + (parsedRow - 1) * gridCols + (parsedCol - 1)
      : -1;
  const posChanged = newPos >= 0 && newPos !== position;
  const parsedAmount = Number.parseFloat(amountVal);
  const amountChanged =
    !Number.isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount !== initialAmount;

  function handleMove() {
    if (!posChanged) return;
    startMoveTransition(async () => {
      const result = await moveToolItemListEntryAction(orgId, listId, position, newPos);
      if (!result.ok) {
        toast.error("Failed to move item.");
        return;
      }
      toast.success("Item moved.");
      onClose();
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await removeToolItemListEntryAction(orgId, listId, entryId);
      if (!result.ok) {
        toast.error("Failed to remove item.");
        return;
      }
      toast.success(`"${item.name}" removed.`);
      onClose();
    });
  }

  function handleAmountUpdate() {
    if (!amountChanged) return;
    startAmountTransition(async () => {
      const result = await updateToolItemListEntryAmountAction(
        orgId,
        listId,
        entryId,
        parsedAmount,
      );
      if (!result.ok) {
        toast.error("Failed to update amount.");
        return;
      }
      toast.success("Quantity updated.");
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
    <div className="flex h-full flex-col bg-card">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {item.imageSignedUrl ? (
          <Image
            src={item.imageSignedUrl}
            alt={item.name}
            fill
            className="object-cover"
            sizes="300px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="select-none text-5xl font-semibold uppercase text-muted-foreground/20">
              {item.name.charAt(0)}
            </span>
          </div>
        )}

        {totalInCell > 1 && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-linear-to-t from-black/60 to-transparent px-2 py-1.5">
            <button
              className={cn(
                "rounded p-1 text-white transition-opacity",
                subIndex === 0 ? "pointer-events-none opacity-20" : "hover:bg-white/20",
              )}
              aria-label="Previous item in cell"
              disabled={subIndex === 0}
              onClick={() => onNavigate?.("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium tabular-nums text-white/80">
              {subIndex + 1} / {totalInCell}
            </span>
            <button
              className={cn(
                "rounded p-1 text-white transition-opacity",
                subIndex >= totalInCell - 1
                  ? "pointer-events-none opacity-20"
                  : "hover:bg-white/20",
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

      <div className="border-b border-border px-4 py-3">
        <div className="space-y-3">
          <div>
            <p className="text-base font-semibold leading-tight">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.unit}</p>
          </div>

          {canManage && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Pencil className="h-3 w-3" />
                  Quantity
                </div>
                <span className="text-[10px] text-muted-foreground/70">Edit and save</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={amountVal}
                  onChange={(e) => setAmountVal(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={!amountChanged || isAmountPending}
                  onClick={handleAmountUpdate}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="border-b border-border px-4 py-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                Position
              </p>
              <span className="text-[10px] text-muted-foreground/70">{position + 1} in list</span>
            </div>
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
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={!posChanged || isMovePending}
                onClick={handleMove}
              >
                Move item
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-destructive hover:text-destructive"
                disabled={isDeletePending}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {setName && relevantRates.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
              Rates
            </p>
            <span className="truncate text-[10px] text-muted-foreground/70">{setName}</span>
          </div>

          {relevantRates.length > 3 && (
            <div className="mb-3 rounded-md border border-input bg-background px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter rates…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filteredRates.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No matches.</p>
              </div>
            ) : (
              <div className="space-y-1">
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
                        "flex items-center gap-3 rounded-md border border-border/60 bg-background px-3 py-2.5 transition-opacity",
                        hidden && "opacity-40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium transition-all",
                            hidden && "line-through text-muted-foreground",
                          )}
                        >
                          {otherItem.name}
                        </p>
                        <p
                          className={cn(
                            "text-xs tabular-nums text-muted-foreground",
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
        </div>
      )}

      {!canManage && (!setName || relevantRates.length === 0) && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">No rates for this item.</p>
        </div>
      )}
    </div>
  );
}
