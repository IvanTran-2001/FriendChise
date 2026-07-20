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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemImage } from "@/components/ui/item-image";
import { unitPillClasses } from "@/lib/core/measurement";
import { cn } from "@/lib/core/utils";
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
          view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden">
                  <Skeleton className="w-full h-36 rounded-none" />
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-card">
                  <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-10 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          )
        ) : items.length === 0 && !search.trim() ? (
          <EmptyState
            icon={Package}
            title="No items yet"
            action={canManage ? { label: "Create your first item", onClick: onCreateItem } : undefined}
          />
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
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ItemImage src={item.imageSignedUrl} name={item.name} className="h-36" />

      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{item.name}</span>
        <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", unitPillClasses(item.unit))}>
          {item.unit}
        </span>
      </div>
    </button>
  );
}

// ─── Item Row (list view) ─────────────────────────────────────────────────────

function ItemRow({ item, onClick }: { item: ToolItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <ItemImage src={item.imageSignedUrl} name={item.name} className="h-10 w-10 rounded-md shrink-0" fallbackTextClassName="text-base" />
      <span className="flex-1 font-medium text-sm truncate">{item.name}</span>
      <span className={cn("shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", unitPillClasses(item.unit))}>
        {item.unit}
      </span>
    </button>
  );
}
