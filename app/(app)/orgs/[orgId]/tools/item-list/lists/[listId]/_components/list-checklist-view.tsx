"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, List, Pencil, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { cn } from "@/lib/core/utils";
import { toast } from "sonner";
import {
  toggleChecklistEntryAction,
  updateToolItemListEntryAmountAction,
} from "@/app/actions/tools";
import type { ListDetail } from "./list-detail-client";
import type { ConversionRate } from "./item-rates-panel";

interface ListChecklistViewProps {
  orgId: string;
  list: ListDetail;
  canManage: boolean;
  activeSetRates: ConversionRate[];
}

export function ListChecklistView({
  orgId,
  list,
  canManage,
  activeSetRates,
}: ListChecklistViewProps) {
  const [entries, setEntries] = useState(list.entries);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [expandedRates, setExpandedRates] = useState<Record<string, boolean>>({});
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [pendingAmountId, setPendingAmountId] = useState<string | null>(null);

  const rateMap = useMemo(() => {
    const map = new Map<string, ConversionRate[]>();
    for (const rate of activeSetRates) {
      const ids = [rate.fromItem.id, rate.toItem.id];
      for (const id of ids) {
        const current = map.get(id) ?? [];
        current.push(rate);
        map.set(id, current);
      }
    }
    return map;
  }, [activeSetRates]);

  const filtered = search
    ? entries.filter((e) =>
        e.item.name.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  function handleToggle(entryId: string) {
    if (!canManage || pending) return;
    // Capture the original entry for revert if server action fails
    const original = entries.find((e) => e.id === entryId);
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              checklistEntry: e.checklistEntry
                ? null
                : { id: "optimistic", listEntryId: entryId, checkedAt: new Date() },
            }
          : e,
      ),
    );
    startTransition(async () => {
      const result = await toggleChecklistEntryAction(entryId, list.id, orgId);
      if (!result.ok) {
        // Revert to original state
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId && original ? { ...original } : e)),
        );
      }
    });
  }

  function startEditingAmount(entry: ListDetail["entries"][number]) {
    setEditingAmountId(entry.id);
    setEditingAmount(String(entry.amount));
  }

  function commitAmount(entry: ListDetail["entries"][number]) {
    const parsed = Number.parseFloat(editingAmount);
    setEditingAmountId(null);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed === entry.amount) return;
    setPendingAmountId(entry.id);
    startTransition(async () => {
      const result = await updateToolItemListEntryAmountAction(orgId, list.id, entry.id, parsed);
      if (!result.ok) {
        toast.error("Failed to update amount.");
      } else {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, amount: parsed } : e)),
        );
      }
      setPendingAmountId(null);
    });
  }

  return (
    <>
      <RegisterPageToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search items"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7"
          />
        </div>
      </RegisterPageToolbar>

      <div>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <List className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">No items in this list</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-16">
            <p className="text-sm text-muted-foreground">
              No items match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border overflow-hidden bg-card shadow-sm">
            {filtered.map((entry) => {
              const checked = !!entry.checklistEntry;
              const rates = rateMap.get(entry.item.id) ?? [];
              const isRatesOpen = !!expandedRates[entry.id];
              const isEditingAmount = editingAmountId === entry.id || pendingAmountId === entry.id;
              return (
                <div key={entry.id} className={cn("transition-colors", checked && "bg-muted/30") }>
                  <div
                    role={canManage ? "button" : undefined}
                    tabIndex={canManage ? 0 : undefined}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors",
                      canManage && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={() => handleToggle(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle(entry.id);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                        checked
                          ? "bg-primary border-primary"
                          : "border-border bg-background",
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          checked && "line-through text-muted-foreground",
                        )}
                      >
                        {entry.item.name}
                      </p>
                    </div>

                    {canManage ? (
                      <div
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {isEditingAmount ? (
                          <div className={cn(
                            "flex items-center gap-1 rounded-md border border-primary/30 bg-background px-2 py-1",
                            pendingAmountId === entry.id && "opacity-70",
                          )}>
                            <Input
                              autoFocus
                              type="number"
                              min="0"
                              step="any"
                              value={editingAmount}
                              disabled={pendingAmountId === entry.id}
                              onChange={(e) => setEditingAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitAmount(entry);
                                if (e.key === "Escape") setEditingAmountId(null);
                              }}
                              onBlur={() => commitAmount(entry)}
                              className="h-7 w-20 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                            />
                            <span className="text-xs text-muted-foreground">{entry.item.unit}</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2"
                            onClick={() => startEditingAmount(entry)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{entry.amount}</span>
                            <span className="text-muted-foreground">{entry.item.unit}</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-muted-foreground"
                          onClick={() =>
                            setExpandedRates((prev) => ({
                              ...prev,
                              [entry.id]: !prev[entry.id],
                            }))
                          }
                        >
                          {isRatesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <span className="ml-1">Rates</span>
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {canManage && isRatesOpen && rates.length > 0 && (
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                        <Sparkles className="h-3 w-3" />
                        Rates
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {rates.map((rate) => {
                          const isToItem = rate.toItem.id === entry.item.id;
                          const otherItem = isToItem ? rate.fromItem : rate.toItem;
                          const multiplier = isToItem
                            ? rate.fromQty / rate.toQty
                            : rate.toQty / rate.fromQty;
                          const label = Number.isInteger(multiplier)
                            ? String(multiplier)
                            : multiplier >= 10
                              ? multiplier.toFixed(1)
                              : multiplier >= 1
                                ? multiplier.toFixed(2)
                                : multiplier.toFixed(3);
                          return (
                            <div
                              key={rate.id}
                              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{otherItem.name}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {label} {otherItem.unit}
                                </p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
