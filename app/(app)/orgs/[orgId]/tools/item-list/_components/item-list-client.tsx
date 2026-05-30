"use client";

/**
 * ItemListClient — display-only content area for /orgs/[orgId]/tools/item-list.
 *
 * Owns: search state, pagination state.
 * Receives: items array, view mode, click callbacks — all managed by ItemListPageClient.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";

export type ToolItem = {
  id: string;
  name: string;
  unit: string;
  imgUrl: string | null;
  imageSignedUrl: string | null;
};

interface ItemListClientProps {
  orgId: string;
  items: ToolItem[];
  view: "grid" | "list";
  canManage: boolean;
  onItemClick: (item: ToolItem) => void;
  onCreateItem: () => void;
}

export function ItemListClient({
  items,
  view,
  canManage,
  onItemClick,
  onCreateItem,
}: ItemListClientProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = search
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.unit.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const PAGE_SIZE = view === "grid" ? 24 : 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-7"
          />
        </div>
      </RegisterPageToolbar>

      <div>
        {items.length === 0 ? (
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
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-16">
            <p className="text-sm text-muted-foreground">
              No items match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginated.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
            {paginated.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} &middot; {filtered.length}{" "}
              items
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
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
