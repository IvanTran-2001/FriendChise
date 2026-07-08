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

import { useCallback, useRef, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import {
  createConversionRateAction,
  deleteConversionRateAction,
  updateConversionRateAction,
} from "@/app/actions/tools";

type ToolItem = { id: string; name: string; unit: string };
type Rate = {
  id: string;
  fromQty: number;
  toQty: number;
  fromItem: ToolItem;
  toItem: ToolItem;
};

// ─── Edit form ────────────────────────────────────────────────────────────────

function EditRateForm({
  orgId,
  setId,
  rate,
  onUpdate,
  onDelete,
  onBack,
}: {
  orgId: string;
  setId: string;
  rate: Rate;
  onUpdate: (id: string, fromQty: number, toQty: number) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const [fromQty, setFromQty] = useState(rate.fromQty.toString());
  const [toQty, setToQty] = useState(rate.toQty.toString());
  const [isPending, startTransition] = useTransition();

  const canSave =
    parseFloat(fromQty) > 0 &&
    parseFloat(toQty) > 0 &&
    Number.isFinite(parseFloat(fromQty)) &&
    Number.isFinite(parseFloat(toQty));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateConversionRateAction(
        orgId,
        setId,
        rate.id,
        parseFloat(fromQty),
        parseFloat(toQty),
      );
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to update rate.",
        );
        return;
      }
      onUpdate(rate.id, result.fromQty, result.toQty);
      toast.success("Rate updated.");
      onBack();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteConversionRateAction(orgId, setId, rate.id);
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to delete rate.",
        );
        return;
      }
      onDelete(rate.id);
      toast.success("Rate removed.");
      onBack();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">From</label>
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground truncate">
            {rate.fromItem.name}
            <span className="ml-1 text-xs">({rate.fromItem.unit})</span>
          </span>
          <Input
            type="number"
            min="0.0001"
            step="any"
            value={fromQty}
            onChange={(e) => setFromQty(e.target.value)}
            className="w-20 shrink-0"
            disabled={isPending}
            autoFocus
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">To</label>
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground truncate">
            {rate.toItem.name}
            <span className="ml-1 text-xs">({rate.toItem.unit})</span>
          </span>
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

      <Button type="submit" disabled={!canSave || isPending} className="w-full">
        Save
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        className="w-full"
        onClick={handleDelete}
      >
        Delete
      </Button>
    </form>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

interface AddRateFormProps {
  orgId: string;
  setId: string;
  rates: Rate[];
  onClose: () => void;
}

export function AddRateForm({
  orgId,
  setId,
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
  const { open } = useActionSidebar();
  const editKeyRef = useRef(0);
  const [rateList, setRateList] = useState(rates);
  const rateListRef = useRef(rateList);

  function updateRateList(fn: (prev: Rate[]) => Rate[]) {
    const next = fn(rateListRef.current);
    rateListRef.current = next;
    setRateList(next);
  }
  const [fromItem, setFromItem] = useState<ToolItem | null>(null);
  const [toItem, setToItem] = useState<ToolItem | null>(null);
  const [fromQty, setFromQty] = useState("1");
  const [toQty, setToQty] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  function itemLabel(item: ToolItem) {
    return `${item.name} (${abbrevUnit(item.unit)})`;
  }

  const loadItems = useCallback(async (search: string, page: number, signal: AbortSignal) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "24",
      search,
    });
    const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`, {
      signal,
    });
    if (!response.ok) throw new Error("Failed to load items.");

    const data = (await response.json()) as {
      items: Array<{ id: string; name: string; unit: string }>;
      totalPages: number;
      page: number;
    };

    return {
      items: data.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.unit,
      })) satisfies ComboboxItem[],
      hasMore: data.page < data.totalPages,
    };
  }, [orgId]);

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
      updateRateList((prev) => [...prev, result.rate]);
      toast.success("Rate added.");
    });
  }

  function openEdit(rate: Rate) {
    const k = ++editKeyRef.current;
    function goBack() {
      const k2 = ++editKeyRef.current;
      open(
        "Rates",
        <div key={k2} className="p-4">
          <AddRateForm
            orgId={orgId}
            setId={setId}
            toolItems={toolItems}
            rates={rateListRef.current}
            onClose={() => {}}
          />
        </div>,
      );
    }
    open(
      "Edit Rate",
      <div key={k} className="p-4">
        <EditRateForm
          orgId={orgId}
          setId={setId}
          rate={rate}
          onUpdate={(id, fromQty, toQty) =>
            updateRateList((prev) =>
              prev.map((r) => (r.id === id ? { ...r, fromQty, toQty } : r)),
            )
          }
          onDelete={(id) =>
            updateRateList((prev) => prev.filter((r) => r.id !== id))
          }
          onBack={goBack}
        />
      </div>,
    );
  }

  const filteredRates = (
    search
      ? rateList.filter(
          (r) =>
            r.fromItem.name.toLowerCase().includes(search.toLowerCase()) ||
            r.toItem.name.toLowerCase().includes(search.toLowerCase()),
        )
      : rateList
  )
    .slice()
    .sort((a, b) => b.toQty / b.fromQty - a.toQty / a.fromQty);

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
                items={[]}
                loadItems={loadItems}
                onSelect={(item) => {
                  setFromItem({
                    id: item.id,
                    name: item.name,
                    unit: item.description ?? "",
                  });
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
                items={[]}
                loadItems={loadItems}
                onSelect={(item) => {
                  setToItem({
                    id: item.id,
                    name: item.name,
                    unit: item.description ?? "",
                  });
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

        <Button
          type="submit"
          disabled={!canSubmit || isPending}
          className="w-full"
        >
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
              return (
                <div
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-3 text-xs cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Top: conversion direction */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-medium truncate">
                        {r.fromItem.name}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {r.toItem.name}
                      </span>
                    </div>
                    {/* Bottom: original ratio */}
                    <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
                      <span className="shrink-0">{r.fromQty}</span>
                      <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                      <span className="shrink-0">{r.toQty}</span>
                      <span className="truncate">{r.toItem.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
