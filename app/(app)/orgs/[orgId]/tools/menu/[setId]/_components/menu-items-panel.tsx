"use client";

/**
 * Menu items panel.
 * Renders the selected menu items as either cards or rows and resolves image
 * previews so the panel can show the same item data in both layouts.
 */

import { useEffect, useMemo, useState, type RefObject } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getOrgStorageReadUrl } from "@/app/actions/storage";
import type { MenuDetail } from "@/lib/services/tools/menus";

export function MenuItemsPanel({
  orgId,
  menu,
  items,
  selectedCategoryName,
  view,
  canManage,
  onEditItem,
  onDeleteItem,
  emptyStateText,
  totalCount,
  hasMore,
  isLoadingMore,
  sentinelRef,
  searchQuery,
  priceByItemId,
}: {
  orgId: string;
  menu: MenuDetail;
  items: MenuDetail["items"];
  selectedCategoryName: string;
  view: "card" | "list";
  canManage: boolean;
  onEditItem: (item: MenuDetail["items"][number]) => void;
  onDeleteItem: (item: MenuDetail["items"][number]) => void;
  emptyStateText?: string;
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  searchQuery: string;
  priceByItemId?: Record<string, number | null>;
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const categoryLookup = useMemo(() => {
    const lookup = new Map<string, string[]>();

    for (const tab of menu.tabs) {
      for (const placement of tab.placements) {
        const current = lookup.get(placement.menuItem.id) ?? [];
        if (!current.includes(tab.name)) {
          lookup.set(placement.menuItem.id, [...current, tab.name]);
        }
      }
    }

    return lookup;
  }, [menu.tabs]);

  useEffect(() => {
    let cancelled = false;
    const paths = new Set<string>();

    for (const item of items) {
      const path = item.imageUrl || item.toolItem.imgUrl;
      if (path) paths.add(path);
    }

    void (async () => {
      if (paths.size === 0) {
        setSignedUrls({});
        return;
      }

      const entries = await Promise.all(
        [...paths].map(async (path) => {
          const result = await getOrgStorageReadUrl(orgId, path);
          return [path, result.ok ? result.signedUrl : ""] as const;
        }),
      );

      if (cancelled) return;

      setSignedUrls(
        entries.reduce<Record<string, string>>((acc, [path, signedUrl]) => {
          if (signedUrl) acc[path] = signedUrl;
          return acc;
        }, {}),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [items, orgId]);

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCategoryName === "ALL"
              ? searchQuery
                ? hasMore
                  ? "Searching all menu items…"
                  : `Showing ${items.length} matching menu item${items.length === 1 ? "" : "s"}.`
                : items.length >= totalCount
                  ? `Showing all ${totalCount} menu items.`
                  : `Loaded ${items.length} of ${totalCount} menu items.`
              : searchQuery
                ? `Showing ${items.length} matching item${items.length === 1 ? "" : "s"} in ${selectedCategoryName}.`
                : `Showing ${items.length} item${items.length === 1 ? "" : "s"} in ${selectedCategoryName}.`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyStateText ?? "No items in this category."}
          </div>
        ) : view === "card" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                canManage={canManage}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                imageUrl={signedUrls[item.imageUrl || item.toolItem.imgUrl || ""] ?? null}
                categories={categoryLookup.get(item.id) ?? []}
                price={priceByItemId?.[item.id] ?? item.price}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-background">
            {items.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                canManage={canManage}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                imageUrl={signedUrls[item.imageUrl || item.toolItem.imgUrl || ""] ?? null}
                categories={categoryLookup.get(item.id) ?? []}
                price={priceByItemId?.[item.id] ?? item.price}
              />
            ))}
          </div>
        )}

        {selectedCategoryName === "ALL" && hasMore && (
          <div
            ref={sentinelRef}
            className="mt-4 flex items-center justify-center rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground"
          >
            {isLoadingMore ? "Loading more items…" : "Scroll to load more"}
          </div>
        )}
      </div>
    </section>
  );
}

function MenuItemCard({
  item,
  canManage,
  onEdit,
  onDelete,
  imageUrl,
  categories,
  price,
}: {
  item: MenuDetail["items"][number];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  imageUrl: string | null;
  categories: string[];
  price: number | null;
}) {
  const hue = [...item.title].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <article className="overflow-hidden rounded-2xl border bg-background shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold select-none" style={{ backgroundColor: bg, color: fg }}>
            {item.title.charAt(0).toUpperCase()}
          </div>
        )}
        {canManage ? (
          <div className="absolute right-2 top-2">
            <MenuItemActions onEdit={onEdit} onDelete={onDelete} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.toolItem.name} · {item.toolItem.unit}
            </p>
          </div>
          {price !== null ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {price}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {item.calories !== null ? <Badge label="Calories" value={item.calories.toString()} /> : null}
          {price !== null ? <Badge label="Price" value={price.toString()} /> : null}
          {categories.length > 0 ? <Badge label={categories.length === 1 ? "Category" : "Categories"} value={categories.join(", ")} /> : null}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</p>
          <p className="text-sm text-muted-foreground">{item.description || "No description."}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="text-sm text-muted-foreground">{item.notes || "No notes."}</p>
        </div>
      </div>
    </article>
  );
}

function MenuItemRow({
  item,
  canManage,
  onEdit,
  onDelete,
  imageUrl,
  categories,
  price,
}: {
  item: MenuDetail["items"][number];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  imageUrl: string | null;
  categories: string[];
  price: number | null;
}) {
  const hue = [...item.title].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <article className="flex gap-3 p-4 transition-colors hover:bg-muted/30">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted/30">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold select-none" style={{ backgroundColor: bg, color: fg }}>
            {item.title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.toolItem.name} · {item.toolItem.unit}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {price !== null ? (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {price}
              </span>
            ) : null}
            {canManage ? <MenuItemActions onEdit={onEdit} onDelete={onDelete} /> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {item.calories !== null ? <Badge label="Calories" value={item.calories.toString()} /> : null}
          {price !== null ? <Badge label="Price" value={price.toString()} /> : null}
          {categories.length > 0 ? <Badge label={categories.length === 1 ? "Category" : "Categories"} value={categories.join(", ")} /> : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {item.description || "No description."}
        </p>

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Notes:</span> {item.notes || "No notes."}
        </p>
      </div>
    </article>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      <span>{label}:</span>
      <span className="text-foreground/80">{value}</span>
    </span>
  );
}

function MenuItemActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Item actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}