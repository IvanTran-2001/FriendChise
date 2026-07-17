"use client";

/**
 * ItemListClient — display-only content area for /orgs/[orgId]/tools/item-list.
 *
 * Owns: search display, load-more sentinel, and the item list rendering.
 * Receives: items array and callbacks — all managed by ItemListPageClient.
 */

import { useMemo, type RefObject } from "react";
import { Loader2, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";

export type ToolItem = {
  id: string;
  name: string;
  unit: string;
  imgUrl: string | null;
  imageSignedUrl: string | null;
};

interface ItemListClientProps {
  items: ToolItem[];
  view: "grid" | "list";
  canManage: boolean;
  onItemClick: (item: ToolItem) => void;
  onCreateItem: () => void;
  search: string;
  totalCount: number;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  onSearchChange: (value: string) => void;
}

export function ItemListClient({
  items,
  view,
  canManage,
  onItemClick,
  onCreateItem,
  search,
  totalCount,
  isLoadingInitial,
  isLoadingMore,
  hasMore,
  sentinelRef,
  onSearchChange,
}: ItemListClientProps) {
  const displayCount = useMemo(() => {
    if (totalCount === 0) return "0 items";
    if (items.length >= totalCount) return `${totalCount} item${totalCount === 1 ? "" : "s"}`;
    return `Loaded ${items.length} of ${totalCount}`;
  }, [items.length, totalCount]);

  return (
    <>
      <RegisterPageToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search items"
            placeholder="Search items…"
            value={search}
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
            className="pl-8 h-7"
          />
        </div>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {displayCount}
        </span>
      </RegisterPageToolbar>

      <div>
        {isLoadingInitial ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <p className="text-sm text-muted-foreground">Loading items…</p>
          </div>
        ) : items.length === 0 && !search.trim() ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">No items yet</p>
              {canManage && (
                <button
                  onClick={onCreateItem}
                  className="text-sm text-primary hover:underline"
                >
                  Create your first item
                </button>
              )}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-16">
            <p className="text-sm text-muted-foreground">
              No items match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div
            ref={sentinelRef}
            className="mt-4 flex items-center justify-center rounded-xl border bg-card px-3 py-3 text-sm text-muted-foreground"
          >
            {isLoadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more items…
              </span>
            ) : (
              <span>Scroll to load more</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: ToolItem; onClick: () => void }) {
  const hue = [...item.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative w-full h-36 overflow-hidden">
        {item.imageSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageSignedUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl font-bold select-none"
            style={{ backgroundColor: bg, color: fg }}
          >
            {item.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{item.name}</span>
        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
          {item.unit}
        </span>
      </div>
    </button>
  );
}

// ─── Item Row (list view) ─────────────────────────────────────────────────────

function ItemRow({ item, onClick }: { item: ToolItem; onClick: () => void }) {
  const hue = [...item.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <div className="h-10 w-10 rounded-md overflow-hidden shrink-0">
        {item.imageSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageSignedUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-base font-bold select-none"
            style={{ backgroundColor: bg, color: fg }}
          >
            {item.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="flex-1 font-medium text-sm truncate">{item.name}</span>
      <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
        {item.unit}
      </span>
    </button>
  );
}
