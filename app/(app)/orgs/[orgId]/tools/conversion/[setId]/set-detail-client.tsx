/**
 * SetDetailClient — the interactive conversion calculator.
 *
 * Renders a two-column grid (From / To) for a single ConversionSet.
 * All state — which items are selected and what quantities are entered — is
 * persisted immediately to the DB via `upsertTemplateEntryAction` so the
 * calculator is fully restored on page reload.
 *
 * Template switching is URL-driven: `?template=<id>`. The parent server page
 * passes `key={activeTemplateId}` so this component fully remounts whenever
 * the active template changes, picking up the new `initialEntries` from the
 * server without any manual reset logic.
 */
"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import {
  upsertTemplateEntryAction,
  removeTemplateEntryAction,
} from "@/app/actions/tools";

type ToolItem = { id: string; name: string; unit: string };
type Rate = {
  id: string;
  fromQty: number;
  toQty: number;
  fromItem: ToolItem;
  toItem: ToolItem;
};
type Entry = { itemId: string; quantity: number | null; pinnedOutput: number };

interface SetDetailClientProps {
  orgId: string;
  set: { id: string; name: string };
  rates: Rate[];
  templates: { id: string; name: string }[];
  activeTemplateId: string | null;
  initialEntries: Entry[];
}

/**
 * Resolves the combined rate from `fromId` to `toId`, following chains of
 * conversion rates in the FORWARD direction only (e.g. Boston Cream → Custard
 * → Thick Cream). Rates are never inverted, so a rate stored as A→B cannot
 * be traversed as B→A. This prevents phantom chains like Boston Cream reaching
 * Rasp Custard via the inverse of Rasp Custard → Custard.
 * Uses DFS with a visited set to prevent infinite loops on circular rates.
 * Returns `null` when no path exists.
 */
function resolveChainedRate(
  rates: Rate[],
  fromId: string,
  toId: string,
  visited: Set<string> = new Set(),
): number | null {
  if (fromId === toId) return 1;
  if (visited.has(fromId)) return null;
  visited.add(fromId);
  for (const r of rates) {
    if (r.fromItem.id === fromId) {
      const rest = resolveChainedRate(
        rates,
        r.toItem.id,
        toId,
        new Set(visited),
      );
      if (rest !== null) return (r.toQty / r.fromQty) * rest;
    }
  }
  return null;
}

/**
 * Returns the set of all item IDs reachable from `startIds` by following
 * conversion rates in either direction (bidirectional BFS).
 * Used to filter dropdowns so only connected items are shown.
 */
function getConnectedIds(startIds: string[], rates: Rate[]): Set<string> {
  const visited = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const r of rates) {
      const neighbors: string[] = [];
      if (r.fromItem.id === current) neighbors.push(r.toItem.id);
      if (r.toItem.id === current) neighbors.push(r.fromItem.id);
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }
  return visited;
}

/** Formats a number for display: rounded to the nearest integer. */
function fmt(n: number) {
  return Math.round(n).toString();
}

/**
 * Returns To items that are exactly 1 direct hop from `itemId` and are also
 * present in `toIds`. These become the sub-list for that To row.
 * Max 3 items returned (UI scrolls within that cap).
 */
function getDirectSubItems(
  itemId: string,
  toIds: string[],
  rates: Rate[],
  itemMap: Map<string, ToolItem>,
): { item: ToolItem; directRate: number }[] {
  const results: { item: ToolItem; directRate: number }[] = [];
  for (const r of rates) {
    if (r.fromItem.id === itemId) {
      const neighborId = r.toItem.id;
      if (toIds.includes(neighborId) && neighborId !== itemId) {
        const neighbor = itemMap.get(neighborId);
        if (neighbor)
          results.push({ item: neighbor, directRate: r.toQty / r.fromQty });
      }
    }
  }
  return results;
}

export function SetDetailClient({
  orgId,
  set,
  rates,
  templates,
  activeTemplateId,
  initialEntries,
}: SetDetailClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [expandedToIds, setExpandedToIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedToIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build item lookup from rates
  const itemMap = new Map<string, ToolItem>();
  for (const r of rates) {
    itemMap.set(r.fromItem.id, r.fromItem);
    itemMap.set(r.toItem.id, r.toItem);
  }
  const allItems = Array.from(itemMap.values());

  const activeTemplate =
    templates.find((t) => t.id === activeTemplateId) ?? null;

  // pinnedOutput flags: 1=from, 2=to, 3=both
  const [fromIds, setFromIds] = useState<string[]>(() =>
    initialEntries.filter((e) => e.pinnedOutput & 1).map((e) => e.itemId),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialEntries
        .filter((e) => e.pinnedOutput & 1)
        .map((e) => [e.itemId, String(e.quantity ?? 0)]),
    ),
  );
  const [toIds, setToIds] = useState<string[]>(() =>
    initialEntries.filter((e) => e.pinnedOutput & 2).map((e) => e.itemId),
  );

  const fromItems = fromIds.map((id) => itemMap.get(id)!).filter(Boolean);
  const toItems = toIds.map((id) => itemMap.get(id)!).filter(Boolean);

  const q = search.trim().toLowerCase();
  const visibleFromItems = q
    ? fromItems.filter((i) => i.name.toLowerCase().includes(q))
    : fromItems;
  const visibleToItems = (
    q ? toItems.filter((i) => i.name.toLowerCase().includes(q)) : toItems
  )
    .slice()
    .sort((a, b) => (calcTotal(b) ?? 0) - (calcTotal(a) ?? 0));

  // When the other side has items selected, restrict the dropdown to items
  // that are reachable from those selections (connected via any rate chain).
  // When the other side is empty, show everything so the user can start fresh.
  const connectedToTo = toIds.length > 0 ? getConnectedIds(toIds, rates) : null;
  const connectedToFrom =
    fromIds.length > 0 ? getConnectedIds(fromIds, rates) : null;

  const fromOptions = allItems
    .filter(
      (i) =>
        !fromIds.includes(i.id) &&
        (connectedToTo === null || connectedToTo.has(i.id)),
    )
    .map((i) => ({ id: i.id, name: `${i.name} (${i.unit})` }));

  const toOptions = allItems
    .filter(
      (i) =>
        !toIds.includes(i.id) &&
        (connectedToFrom === null || connectedToFrom.has(i.id)),
    )
    .map((i) => ({ id: i.id, name: `${i.name} (${i.unit})` }));

  function addFrom(item: { id: string }) {
    if (!activeTemplateId) return;
    // if already on to-side, upgrade to both (3); otherwise from-only (1)
    const isAlsoTo = toIds.includes(item.id);
    startTransition(async () => {
      const result = await upsertTemplateEntryAction(
        orgId,
        activeTemplateId,
        item.id,
        0,
        isAlsoTo ? 3 : 1,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to add item.");
        return;
      }
      setFromIds((prev) => [...prev, item.id]);
      setQuantities((prev) => ({ ...prev, [item.id]: "0" }));
    });
  }

  function removeFrom(id: string) {
    if (!activeTemplateId) return;
    // if also on to-side, downgrade to to-only (2); otherwise delete
    const isAlsoTo = toIds.includes(id);
    startTransition(async () => {
      let result;
      if (isAlsoTo) {
        result = await upsertTemplateEntryAction(
          orgId,
          activeTemplateId,
          id,
          null,
          2,
        );
      } else {
        result = await removeTemplateEntryAction(orgId, activeTemplateId, id);
      }
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to remove item.",
        );
        return;
      }
      setFromIds((prev) => prev.filter((x) => x !== id));
      setQuantities((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    });
  }

  function addTo(item: { id: string }) {
    if (!activeTemplateId) return;
    // if already on from-side, upgrade to both (3); otherwise to-only (2)
    const isAlsoFrom = fromIds.includes(item.id);
    const qty = isAlsoFrom ? parseFloat(quantities[item.id] ?? "") || 0 : null;
    startTransition(async () => {
      const result = await upsertTemplateEntryAction(
        orgId,
        activeTemplateId,
        item.id,
        qty,
        isAlsoFrom ? 3 : 2,
      );
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to add item.");
        return;
      }
      setToIds((prev) => [...prev, item.id]);
    });
  }

  function removeTo(id: string) {
    if (!activeTemplateId) return;
    // if also on from-side, downgrade to from-only (1); otherwise delete
    const isAlsoFrom = fromIds.includes(id);
    const qty = parseFloat(quantities[id] ?? "") || 0;
    startTransition(async () => {
      let result;
      if (isAlsoFrom) {
        result = await upsertTemplateEntryAction(
          orgId,
          activeTemplateId,
          id,
          qty,
          1,
        );
      } else {
        result = await removeTemplateEntryAction(orgId, activeTemplateId, id);
      }
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to remove item.",
        );
        return;
      }
      setToIds((prev) => prev.filter((x) => x !== id));
    });
  }

  function handleQtyBlur(itemId: string) {
    if (!activeTemplateId) return;
    const qty = parseFloat(quantities[itemId] ?? "") || 0;
    const isAlsoTo = toIds.includes(itemId);
    startTransition(async () => {
      const result = await upsertTemplateEntryAction(
        orgId,
        activeTemplateId,
        itemId,
        qty,
        isAlsoTo ? 3 : 1,
      );
      if (!result.ok) {
        toast.error(
          "error" in result ? result.error : "Failed to update quantity.",
        );
      }
    });
  }

  function calcTotal(toItem: ToolItem): number | null {
    let total = 0;
    let hasRate = false;
    for (const fromItem of fromItems) {
      const qty = parseFloat(quantities[fromItem.id] ?? "") || 0;
      const rate = resolveChainedRate(rates, fromItem.id, toItem.id);
      if (rate !== null) {
        total += qty * rate;
        hasRate = true;
      }
    }
    return hasRate ? total : null;
  }

  return (
    <>
      <RegisterPageToolbar>
        <h1 className="text-sm font-semibold">{set.name}</h1>
        {templates.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-0.5 hover:border-primary/50 transition-colors">
                {activeTemplate?.name ?? "No template"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() =>
                    router.replace(`?template=${t.id}`, { scroll: false })
                  }
                  className={
                    t.id === activeTemplateId ? "font-medium text-primary" : ""
                  }
                >
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </RegisterPageToolbar>

      <div className="py-4">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No templates yet. Use &ldquo;Templates&rdquo; in the sidebar to
              create one.
            </p>
          </div>
        ) : rates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No rates yet. Use &ldquo;Rates&rdquo; in the sidebar to add
              conversions.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(fromItems.length > 0 || toItems.length > 0) && (
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full"
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* ── From ── */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  From
                </p>
                <SearchableCombobox
                  items={fromOptions}
                  onSelect={addFrom}
                  triggerLabel="Add item…"
                  placeholder="Search items…"
                  disabled={fromOptions.length === 0}
                />
                {fromItems.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {visibleFromItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                      >
                        <button
                          onClick={() => removeFrom(item.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <span className="flex-1 text-sm font-medium truncate">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.unit}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={quantities[item.id] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleQtyBlur(item.id)}
                          placeholder="0"
                          className="w-20 h-7 text-sm shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── To ── */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  To
                </p>
                <SearchableCombobox
                  items={toOptions}
                  onSelect={addTo}
                  triggerLabel="Add item…"
                  placeholder="Search items…"
                  disabled={toOptions.length === 0}
                />
                {toItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add a To item to see calculations.
                  </p>
                ) : visibleToItems.length === 0 ? null : (
                  <div className="flex flex-col gap-2">
                    {visibleToItems.map((item) => {
                      const total = calcTotal(item) ?? 0;
                      const subItems = getDirectSubItems(
                        item.id,
                        toIds,
                        rates,
                        itemMap,
                      );
                      const hasSubItems = subItems.length > 0;
                      const isExpanded = expandedToIds.has(item.id);
                      return (
                        <div key={item.id} className="flex flex-col">
                          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                            <button
                              onClick={() => removeTo(item.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              aria-label={`Remove ${item.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <span className="flex-1 text-sm font-medium truncate">
                              {item.name}
                            </span>
                            <span className="text-sm font-semibold tabular-nums shrink-0">
                              {fmt(total)}{" "}
                              <span className="text-xs font-normal text-muted-foreground">
                                {item.unit}
                              </span>
                            </span>
                            {hasSubItems && (
                              <button
                                onClick={() => toggleExpanded(item.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                aria-label={isExpanded ? "Collapse" : "Expand"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                          {hasSubItems && isExpanded && (
                            <div className="ml-4 mt-1 border-l-2 border-border pl-2 flex flex-col gap-1 max-h-24 overflow-y-auto">
                              {subItems.map(({ item: sub, directRate }) => {
                                const subTotal = total * directRate;
                                return (
                                  <div
                                    key={sub.id}
                                    className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                                  >
                                    <span className="flex-1 truncate text-muted-foreground">
                                      {sub.name}
                                    </span>
                                    <span className="font-medium tabular-nums shrink-0">
                                      {fmt(subTotal)}{" "}
                                      <span className="font-normal text-muted-foreground">
                                        {sub.unit}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
