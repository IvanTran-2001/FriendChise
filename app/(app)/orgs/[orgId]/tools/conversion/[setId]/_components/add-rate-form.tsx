/**
 * AddRateForm — action sidebar panel for managing conversion rates.
 *
 * Two sections:
 *   1. **Create form** — pick From item + quantity and To item + quantity;
 *      the stored rate is `toQty / fromQty`.
 *   2. **Rate list** — searchable list of existing rates with delete buttons.
 *
 * Units are abbreviated in the item dropdowns to prevent the trigger button
 * from expanding: names ≤4 chars are kept as-is; longer ones are condensed to
 * `first letter + last letter` (e.g. "grams" → "gs"). The full unit string is
 * always stored in the DB unchanged.
 */
"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  createConversionRateAction,
  deleteConversionRateAction,
} from "@/app/actions/tools";

type ToolItem = { id: string; name: string; unit: string };
type Rate = {
  id: string;
  rate: number;
  fromItem: ToolItem;
  toItem: ToolItem;
};

interface AddRateFormProps {
  orgId: string;
  setId: string;
  toolItems: ToolItem[];
  rates: Rate[];
  onClose: () => void;
}

export function AddRateForm({
  orgId,
  setId,
  toolItems,
  rates,
  onClose: _onClose,
}: AddRateFormProps) {

  /**
   * Abbreviates a unit string to at most two characters for compact display
   * in the item dropdown trigger (prevents the button from growing).
   * Units ≤4 chars (e.g. "doz", "kg") are returned unchanged.
   * Longer units are condensed to first + last character (e.g. "grams" → "gs").
   */
  function abbrevUnit(unit: string): string {
    return unit.length <= 4 ? unit : unit[0] + unit[unit.length - 1];
  }
  const [rateList, setRateList] = useState(rates);
  const [fromItem, setFromItem] = useState<ToolItem | null>(null);
  const [toItem, setToItem] = useState<ToolItem | null>(null);
  const [fromQty, setFromQty] = useState("1");
  const [toQty, setToQty] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const comboItems = toolItems.map((i) => ({
    id: i.id,
    name: `${i.name} (${abbrevUnit(i.unit)})`,
  }));

  function itemLabel(item: ToolItem) {
    return `${item.name} (${abbrevUnit(item.unit)})`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromItem || !toItem) return;
    const fq = parseFloat(fromQty);
    const tq = parseFloat(toQty);
    startTransition(async () => {
      const result = await createConversionRateAction(
        orgId,
        setId,
        fromItem.id,
        toItem.id,
        fq,
        tq,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to add rate.");
        return;
      }
      setRateList((prev) => [...prev, result.rate]);
      toast.success("Rate added.");
    });
  }

  function handleDelete(rateId: string) {
    setDeletingId(rateId);
    startTransition(async () => {
      const result = await deleteConversionRateAction(orgId, setId, rateId);
      if (!result.ok) toast.error("Failed to delete rate.");
      else {
        setRateList((prev) => prev.filter((r) => r.id !== rateId));
        toast.success("Rate removed.");
      }
      setDeletingId(null);
    });
  }

  const filteredRates = search
    ? rateList.filter(
        (r) =>
          r.fromItem.name.toLowerCase().includes(search.toLowerCase()) ||
          r.toItem.name.toLowerCase().includes(search.toLowerCase()),
      )
    : rateList;

  const canSubmit =
    !!fromItem &&
    !!toItem &&
    fromItem.id !== toItem.id &&
    parseFloat(fromQty) > 0 &&
    parseFloat(toQty) > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Add rate form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">From</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SearchableCombobox
                items={comboItems}
                onSelect={(item) => {
                  const found = toolItems.find((i) => i.id === item.id);
                  setFromItem(found ?? null);
                }}
                triggerLabel={fromItem ? itemLabel(fromItem) : "Select item"}
                placeholder="Search items…"
                disabled={isPending}
              />
            </div>
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={fromQty}
              onChange={(e) => setFromQty(e.target.value)}
              className="w-20 shrink-0"
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">To</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SearchableCombobox
                items={comboItems}
                onSelect={(item) => {
                  const found = toolItems.find((i) => i.id === item.id);
                  setToItem(found ?? null);
                }}
                triggerLabel={toItem ? itemLabel(toItem) : "Select item"}
                placeholder="Search items…"
                disabled={isPending}
              />
            </div>
            <Input
              type="number"
              min="0.0001"
              step="any"
              value={toQty}
              onChange={(e) => setToQty(e.target.value)}
              className="w-20 shrink-0"
              placeholder="qty"
              disabled={isPending}
            />
          </div>
        </div>

        <Button type="submit" disabled={!canSubmit || isPending} className="w-full">
          Add Rate
        </Button>
      </form>

      <hr className="border-border" />

      {/* Rate list */}
      <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rate List
            </span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 w-32 text-xs"
            />
          </div>
          {rateList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No rates yet.</p>
          ) : filteredRates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No matches.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredRates.map((r) => {
              const display =
                r.rate % 1 === 0
                  ? r.rate.toString()
                  : r.rate.toFixed(4).replace(/\.?0+$/, "");
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-3 text-xs"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Top: conversion direction */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-medium truncate">{r.fromItem.name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{r.toItem.name}</span>
                    </div>
                    {/* Bottom: rate + unit */}
                    <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
                      <span className="shrink-0">{display}</span>
                      <span className="truncate">{r.toItem.unit}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending && deletingId === r.id}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Delete rate"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            </div>
          )}
        </div>
    </div>
  );
}
