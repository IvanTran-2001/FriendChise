"use client";

/**
 * ItemListClient — main content area for /orgs/[orgId]/tools/item-list.
 *
 * Toolbar: search input + "New Item" button.
 * Body: grid of item cards. Clicking a card opens an ActionSidebar detail panel.
 * "New Item" opens an ActionSidebar create panel.
 *
 * Local state is the source of truth for the item list so mutations
 * (create / update / delete) reflect instantly without a page reload.
 */

import { useRef, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toolbar } from "@/components/layout/toolbar";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { ItemDetailPanel } from "./item-detail-panel";

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
  canManage: boolean;
}

export function ItemListClient({ orgId, items: initial, canManage }: ItemListClientProps) {
  const { open, close } = useActionSidebar();
  const keyRef = useRef(0);
  const [items, setItems] = useState<ToolItem[]>(initial);
  const [search, setSearch] = useState("");

  const filtered = search
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.unit.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  function openPanel(title: string, content: React.ReactNode) {
    const k = ++keyRef.current;
    open(title, <div key={k}>{content}</div>);
  }

  function handleCreate() {
    openPanel(
      "New Item",
      <ItemDetailPanel
        orgId={orgId}
        mode="create"
        canManage={canManage}
        onCreated={(item) => {
          setItems((prev) =>
            [...prev, item].sort((a, b) => a.name.localeCompare(b.name)),
          );
          close();
        }}
        onClose={close}
      />,
    );
  }

  function handleItemClick(item: ToolItem) {
    openPanel(
      item.name,
      <ItemDetailPanel
        orgId={orgId}
        mode="edit"
        item={item}
        canManage={canManage}
        onUpdated={(updated) => {
          setItems((prev) =>
            prev
              .map((i) => (i.id === updated.id ? updated : i))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
          // Re-open panel with updated item so title + data stay fresh
          openPanel(
            updated.name,
            <ItemDetailPanel
              orgId={orgId}
              mode="edit"
              item={updated}
              canManage={canManage}
              onUpdated={(u) =>
                setItems((prev) =>
                  prev.map((i) => (i.id === u.id ? u : i)).sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                )
              }
              onDeleted={(id) => {
                setItems((prev) => prev.filter((i) => i.id !== id));
                close();
              }}
              onClose={close}
            />,
          );
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          close();
        }}
        onClose={close}
      />,
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Toolbar>
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
        {canManage && (
          <Button size="sm" className="h-7 gap-1.5 shrink-0" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            New Item
          </Button>
        )}
      </Toolbar>

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6">
        {items.length === 0 ? (
          <div className="flex items-center justify-center border rounded-lg py-24">
            <div className="flex flex-col items-center gap-3 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-2xl font-semibold">No items yet</p>
              {canManage && (
                <button
                  onClick={handleCreate}
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
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: ToolItem; onClick: () => void }) {
  // Generate a deterministic pastel color from the item name for the placeholder.
  const hue = [...item.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Image / placeholder */}
      <div className="relative w-full aspect-square overflow-hidden">
        {item.imageSignedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageSignedUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.03] duration-300"
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

      {/* Info */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{item.name}</span>
        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
          {item.unit}
        </span>
      </div>
    </button>
  );
}
