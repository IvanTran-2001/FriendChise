"use client";

/**
 * Item list page client.
 * Owns the API-backed item data, infinite loading, search, and the item detail
 * sidebar state for the item list tool.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const pageSize = view === "grid" ? 24 : 30;

  const mergeUniqueItems = useCallback((current: ToolItem[], incoming: ToolItem[]) => {
    const byId = new Map<string, ToolItem>();
    for (const item of current) byId.set(item.id, item);
    for (const item of incoming) byId.set(item.id, item);
    return Array.from(byId.values());
  }, []);

  const triggerReload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const loadItems = useCallback(
    async ({
      targetPage,
      replace,
      signal,
      requestSeq,
    }: {
      targetPage: number;
      replace: boolean;
      signal: AbortSignal;
      requestSeq: number;
    }) => {
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("limit", String(pageSize));
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(`/api/orgs/${orgId}/tools/item-list?${params.toString()}`,
        { signal },
      );
      if (!response.ok) throw new Error("Failed to load items.");

      const data = (await response.json()) as {
        items: ToolItem[];
        totalPages: number;
        totalCount: number;
        page: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setItems((current) =>
        replace ? mergeUniqueItems([], data.items) : mergeUniqueItems(current, data.items),
      );
      setTotalPages(Math.max(1, data.totalPages));
      setTotalCount(data.totalCount);
      setPage(data.page);
    },
    [mergeUniqueItems, orgId, pageSize, search],
  );

  useEffect(() => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    void (async () => {
      setIsLoadingInitial(true);
      setIsLoadingMore(false);
      try {
        setItems([]);
        setPage(1);
        setTotalPages(1);
        setTotalCount(0);
        await loadItems({
          targetPage: 1,
          replace: true,
          signal: controller.signal,
          requestSeq,
        });
      } catch {
        if (requestSeqRef.current !== requestSeq) return;
        setItems([]);
        setTotalPages(1);
        setTotalCount(0);
        toast.error("Failed to load items.");
      } finally {
        if (requestSeqRef.current !== requestSeq) return;
        setIsLoadingInitial(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [loadItems, orgId, pageSize, reloadToken, search]);

  useEffect(() => {
    if (isLoadingInitial || isLoadingMore) return;
    if (items.length === 0) return;
    if (page === 0 || page >= totalPages) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isLoadingInitial || isLoadingMore || page >= totalPages) return;

        const nextPage = page + 1;
        const requestSeq = requestSeqRef.current;
        const controller = new AbortController();
        setIsLoadingMore(true);

        void loadItems({
          targetPage: nextPage,
          replace: false,
          signal: controller.signal,
          requestSeq,
        })
          .catch(() => {
            // Retry on the next intersection.
          })
          .finally(() => {
            if (requestSeqRef.current !== requestSeq) return;
            setIsLoadingMore(false);
          });

        return () => controller.abort();
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoadingInitial, isLoadingMore, items.length, loadItems, page, totalPages]);

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
            triggerReload();
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
            triggerReload();
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
                triggerReload();
                close();
              }}
              onClose={close}
            />,
          );
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setTotalCount((current) => Math.max(0, current - 1));
          triggerReload();
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
        totalCount={totalCount}
          isLoadingInitial={isLoadingInitial}
          isLoadingMore={isLoadingMore}
          hasMore={items.length > 0 && page < totalPages}
          sentinelRef={sentinelRef}
          onLoadMore={() => {
            setPage((current) => Math.min(current + 1, totalPages));
          }}
          onSearchChange={(value) => {
          setSearch(value);
        }}
      />
    </>
  );
}
