"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, List, Minus, Plus, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { cn } from "@/lib/core/utils";
import { unitPillClasses } from "@/lib/core/measurement";
import { toast } from "sonner";
import {
  toggleChecklistEntryAction,
  updateToolItemListEntryAmountAction,
} from "@/app/actions/tools";
import type { ListDetail } from "./list-detail-client";
import type { ConversionRate } from "./item-rates-panel";

type Entry = ListDetail["entries"][number];

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
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [isDoneExpanded, setIsDoneExpanded] = useState(false);

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

  const todoEntries = filtered.filter((e) => !e.checklistEntry);
  const doneEntries = filtered.filter((e) => !!e.checklistEntry);
  const totalCount = entries.length;
  const doneCount = entries.filter((e) => !!e.checklistEntry).length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  function handleToggle(entryId: string) {
    if (!canManage || pending) return;
    // Capture the original entry for revert if server action fails
    const original = entries.find((e) => e.id === entryId);
    const willCheck = original ? !original.checklistEntry : false;
    if (willCheck) {
      setPulseId(entryId);
      setTimeout(() => setPulseId((current) => (current === entryId ? null : current)), 260);
    }
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
        toast.error("Failed to update item.");
      }
    });
  }

  function startEditingAmount(entry: Entry) {
    setEditingAmountId(entry.id);
    setEditingAmount(String(entry.amount));
  }

  function commitAmount(entry: Entry, nextValue?: string) {
    const raw = nextValue ?? editingAmount;
    const parsed = Number.parseFloat(raw);
    setEditingAmountId(null);
    if (Number.isNaN(parsed) || parsed < 0 || parsed === entry.amount) return;
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

  function adjustAmount(entry: Entry, delta: number) {
    const base = editingAmountId === entry.id ? Number.parseFloat(editingAmount) : entry.amount;
    const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + delta);
    setEditingAmountId(entry.id);
    setEditingAmount(String(next));
    commitAmount(entry, String(next));
  }

  function renderRow(entry: Entry) {
    const checked = !!entry.checklistEntry;
    const rates = rateMap.get(entry.item.id) ?? [];
    const isRatesOpen = !!expandedRates[entry.id];
    const isEditingAmount = editingAmountId === entry.id || pendingAmountId === entry.id;
    return (
      <div key={entry.id} className={cn("transition-colors", checked && "bg-muted/30")}>
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
              "h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center transition-transform duration-150",
              checked
                ? "bg-primary border-primary"
                : "border-border bg-background",
              pulseId === entry.id && "scale-125",
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
                <div
                  onBlur={(e) => {
                    const next = e.relatedTarget;
                    if (!(next instanceof Node) || !e.currentTarget.contains(next)) {
                      commitAmount(entry);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-md border border-primary/30 bg-background px-1 py-1",
                    pendingAmountId === entry.id && "opacity-70",
                  )}
                >
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={pendingAmountId === entry.id}
                    onClick={() => adjustAmount(entry, -1)}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
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
                    className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={pendingAmountId === entry.id}
                    onClick={() => adjustAmount(entry, 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", unitPillClasses(entry.item.unit))}>
                    {entry.item.unit}
                  </span>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 px-2"
                  onClick={() => startEditingAmount(entry)}
                >
                  <span className="tabular-nums">{entry.amount}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", unitPillClasses(entry.item.unit))}>
                    {entry.item.unit}
                  </span>
                </Button>
              )}
              {rates.length > 0 && (
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
                  <span className="ml-1 hidden sm:inline">Rates</span>
                </Button>
              )}
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
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
          <div className="flex flex-col gap-3">
            {/* Progress header */}
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                  {doneCount} of {totalCount} done
                </span>
                <span className="text-xs text-muted-foreground">
                  {doneCount === totalCount ? "All caught up" : `${totalCount - doneCount} remaining`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    doneCount === totalCount && totalCount > 0 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* To-do rows */}
            {todoEntries.length > 0 ? (
              <div className="flex flex-col divide-y rounded-lg border overflow-hidden bg-card shadow-sm">
                {todoEntries.map((entry) => renderRow(entry))}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed py-10">
                <p className="text-sm text-muted-foreground">Everything is checked off.</p>
              </div>
            )}

            {/* Done section — collapsed by default so the to-do list stays the focus */}
            {doneEntries.length > 0 && (
              <div className="rounded-lg border overflow-hidden bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsDoneExpanded((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  {isDoneExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Done ({doneEntries.length})
                </button>
                {isDoneExpanded && (
                  <div className="flex flex-col divide-y border-t">
                    {doneEntries.map((entry) => renderRow(entry))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
