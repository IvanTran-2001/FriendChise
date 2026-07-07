"use client";

/**
 * Item list page client.
 * Owns the API-backed item data, pagination, search, and the item detail
 * sidebar state for the item list tool.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { ItemListSidebarContent } from "./item-list-sidebar-content";
import { ItemListClient, type ToolItem } from "./item-list-client";
import { ItemDetailPanel } from "./item-detail-panel";

interface ItemListPageClientProps {
  orgId: string;
  canManage: boolean;
  view: "grid" | "list";
}

export function ItemListPageClient({
  orgId,
  canManage,
  view,
}: ItemListPageClientProps) {
  const { open, close } = useActionSidebar();
  const keyRef = useRef(0);
  const [items, setItems] = useState<ToolItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const pageSize = view === "grid" ? 24 : 30;

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (search.trim()) params.set("search", search.trim());

      try {
        const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load items.");
        }
        const data = (await response.json()) as {
          items: ToolItem[];
          totalPages: number;
          totalCount: number;
        };
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(Math.max(1, data.totalPages));
        setTotalCount(data.totalCount);
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotalPages(1);
          setTotalCount(0);
          toast.error("Failed to load items.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadItems();

    return () => {
      cancelled = true;
    };
  }, [orgId, page, pageSize, search]);

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
            setTotalCount((current) => current + 1);
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
          openPanel(
            updated.name,
            <ItemDetailPanel
              orgId={orgId}
              mode="edit"
              item={updated}
              canManage={canManage}
              onUpdated={(u) =>
                setItems((prev) =>
                  prev
                    .map((i) => (i.id === u.id ? u : i))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                )
              }
              onDeleted={(id) => {
                setItems((prev) => prev.filter((i) => i.id !== id));
                setTotalCount((current) => Math.max(0, current - 1));
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
    <>
      <RegisterPageSidebarSubContent
        content={
          <ItemListSidebarContent
            orgId={orgId}
            canManage={canManage}
            view={view}
            onCreateItem={handleCreate}
          />
        }
      />
      <ItemListClient
        items={items}
        view={view}
        canManage={canManage}
        onItemClick={handleItemClick}
        onCreateItem={handleCreate}
        search={search}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        isLoading={isLoading}
        onPageChange={setPage}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
    </>
  );
}
