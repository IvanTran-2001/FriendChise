"use client";

import { useState } from "react";
import { Eye, EyeOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

export type ConversionRate = {
  id: string;
  fromQty: number;
  toQty: number;
  fromItem: { id: string; name: string; unit: string };
  toItem: { id: string; name: string; unit: string };
};

interface ItemRatesPanelProps {
  item: { id: string; name: string; unit: string };
  rates: ConversionRate[];
  setName: string;
  hiddenRateIds: Set<string>;
  onToggleRate: (rateId: string) => void;
}

function formatMultiplier(toQty: number, fromQty: number): string {
  const m = toQty / fromQty;
  if (Number.isInteger(m)) return m.toString();
  if (m >= 10) return m.toFixed(1);
  if (m >= 1) return m.toFixed(2);
  return m.toFixed(3);
}

export function ItemRatesPanel({
  item,
  rates,
  setName,
  hiddenRateIds: initialHidden,
  onToggleRate,
}: ItemRatesPanelProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set(initialHidden));
  const [search, setSearch] = useState("");
  const relevantRates = rates.filter(
    (r) => r.toItem.id === item.id || r.fromItem.id === item.id,
  );
  const filtered = relevantRates.filter((r) => {
    if (!search.trim()) return true;
    const isToItem = r.toItem.id === item.id;
    const otherName = isToItem ? r.fromItem.name : r.toItem.name;
    return otherName.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <p className="text-sm font-semibold">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.unit} &middot; {setName}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Rates involving 1 {item.unit}
        </p>
      </div>

      {/* Search */}
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

      {/* Rate list */}
      <div className="flex-1 overflow-y-auto">
        {relevantRates.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No rates for this item in {setName}.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No matches.</p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((rate) => {
              const hidden = hiddenIds.has(rate.id);
              const isToItem = rate.toItem.id === item.id;
              const otherItem = isToItem ? rate.fromItem : rate.toItem;
              // toItem perspective: how much otherItem per 1 of this = fromQty/toQty
              // fromItem perspective: how much otherItem this produces per 1 of this = toQty/fromQty
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
    </div>
  );
}
