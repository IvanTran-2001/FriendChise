"use client";

/**
 * Menu detail page client.
 * Owns the toolbar filters, sidebar actions, and the menu item view mode so
 * the menu page can swap between card and list layouts without losing state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { Input } from "@/components/ui/input";
import { type FilterComboboxItem } from "@/components/ui/filter-combobox";
import { MenuDetailSidebarContent } from "./menu-detail-sidebar-content";
import { AddMenuCategoryPanel } from "./add-menu-category-panel";
import { AddMenuItemPanel } from "./add-menu-item-panel";
import { MenuDetailHeader } from "./menu-detail-header";
import { MenuItemsPanel } from "./menu-items-panel";
import { deleteMenuItemAction } from "@/app/actions/tools";
import type { MenuDetail } from "@/lib/services/tools/menus";

export function MenuDetailClient({
  orgId,
  menu,
  publicToken,
  canManage,
}: {
  orgId: string;
  menu: MenuDetail;
  publicToken: string;
  canManage: boolean;
}) {
  const { open, close } = useActionSidebar();
  const openKeyRef = useRef(0);
  const requestSeqRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "list">("card");
  const [itemSearch, setItemSearch] = useState("");
  const [allItems, setAllItems] = useState(menu.items);
  const [page, setPage] = useState(menu.itemsPage ?? 1);
  const [totalPages, setTotalPages] = useState(menu.itemsTotalPages ?? 1);
  const [totalCount, setTotalCount] = useState(menu.itemsTotalCount ?? menu.items.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const itemDefaultTabIds = useMemo(() => {
    const map = new Map<string, string>();

    for (const tab of menu.tabs) {
      for (const placement of tab.placements) {
        if (!map.has(placement.menuItem.id)) {
          map.set(placement.menuItem.id, tab.id);
        }
      }
    }

    return map;
  }, [menu.tabs]);

  const selectedTab = useMemo(
    () => menu.tabs.find((tab) => tab.id === selectedTabId) ?? null,
    [menu.tabs, selectedTabId],
  );

  const categoryItems = useMemo<FilterComboboxItem[]>(
    () => [
      { id: "__all__", name: "ALL" },
      ...menu.tabs.map((tab) => ({ id: tab.id, name: tab.name })),
    ],
    [menu.tabs],
  );

  const visibleItems = useMemo(() => {
    if (!selectedTab) return allItems;
    return selectedTab.placements.map((placement) => placement.menuItem);
  }, [allItems, selectedTab]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return visibleItems;

    return visibleItems.filter((item) => {
      const haystacks = [
        item.title,
        item.description ?? "",
        item.notes ?? "",
        item.toolItem.name,
        item.toolItem.unit,
      ];

      return haystacks.some((value) => value.toLowerCase().includes(query));
    });
  }, [itemSearch, visibleItems]);

  const selectedCategoryLabel = selectedTab?.name ?? "ALL";
  const selectedCategoryId = selectedTabId;
  const searchQuery = itemSearch.trim();
  const isSearchingAllItems = selectedTabId === null && searchQuery.length > 0;

  const hasMore = selectedTabId === null && page < totalPages;

  const loadMoreItems = useCallback(async () => {
    if (selectedTabId !== null || isLoadingMore || page >= totalPages) return;

    const nextPage = page + 1;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(menu.itemsPageSize ?? 24));

      const response = await fetch(
        `/api/orgs/${orgId}/tools/menu/${menu.id}/items?${params.toString()}`,
      );

      if (!response.ok) throw new Error("Failed to load menu items.");

      const data = (await response.json()) as {
        items: MenuDetail["items"];
        totalCount: number;
        totalPages: number;
        page: number;
      };

      if (requestSeqRef.current !== requestSeq) return;

      setAllItems((current) => {
        const nextItems = new Map<string, MenuDetail["items"][number]>();
        for (const item of current) nextItems.set(item.id, item);
        for (const item of data.items) nextItems.set(item.id, item);
        return Array.from(nextItems.values());
      });
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      // Retry on the next intersection.
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, menu.id, menu.itemsPageSize, orgId, page, selectedTabId, totalPages]);

  useEffect(() => {
    if (!isSearchingAllItems || !hasMore || isLoadingMore) return;
    void loadMoreItems();
  }, [hasMore, isLoadingMore, isSearchingAllItems, loadMoreItems]);

  useEffect(() => {
    if (selectedTabId !== null) return;
    if (!hasMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void loadMoreItems();
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMoreItems, selectedTabId]);


  function handleAddItem() {
    const key = ++openKeyRef.current;
    open(
      "Add Item",
      <AddMenuItemPanel
        key={key}
        orgId={orgId}
        menuId={menu.id}
        tabs={menu.tabs.map((tab) => ({ id: tab.id, name: tab.name }))}
        defaultTabId={selectedTabId}
        onClose={close}
      />,
    );
  }

  function handleEditItem(item: MenuDetail["items"][number]) {
    const key = ++openKeyRef.current;
    open(
      "Edit Item",
      <AddMenuItemPanel
        key={key}
        orgId={orgId}
        menuId={menu.id}
        tabs={menu.tabs.map((tab) => ({ id: tab.id, name: tab.name }))}
        defaultTabId={selectedTabId ?? itemDefaultTabIds.get(item.id) ?? null}
        initialItem={item}
        mode="edit"
        onClose={close}
      />,
    );
  }

  async function handleDeleteItem(item: MenuDetail["items"][number]) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;

    const result = await deleteMenuItemAction(orgId, menu.id, item.id);
    if (!result.ok) {
      toast.error("error" in result ? result.error : "Failed to delete item.");
      return;
    }

    toast.success(`"${item.title}" deleted.`);
  }

  function handleAddCategory() {
    const key = ++openKeyRef.current;
    open(
      "Category",
      <AddMenuCategoryPanel
        key={key}
        orgId={orgId}
        menuId={menu.id}
        tabs={menu.tabs}
          defaultParentTabId={selectedTabId}
        onClose={close}
      />,
    );
  }

  return (
    <>
      <RegisterPageToolbar>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full min-w-0 flex-1 sm:max-w-sm">
            <Input
              value={itemSearch}
              onChange={(event) => setItemSearch(event.target.value)}
              placeholder="Search items…"
              className="h-9 rounded-full border-border/70 bg-background/85 px-3.5 text-sm shadow-sm"
            />
          </div>
        </div>
      </RegisterPageToolbar>

      <RegisterPageSidebarSubContent
        content={
          <MenuDetailSidebarContent
            canManage={canManage}
            publicToken={publicToken}
            previewClicksThisMonth={menu.previewClicksThisMonth ?? 0}
            categoryItems={categoryItems}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={(categoryId) => {
              setSelectedTabId(categoryId === "__all__" ? null : categoryId);
            }}
            view={view}
            onViewChange={(value) => setView(value)}
            onAddCategory={handleAddCategory}
            onAddItem={handleAddItem}
          />
        }
      />

      <div className="flex flex-col gap-6 py-5">
        <MenuDetailHeader menu={menu} canManage={canManage} />
        <MenuItemsPanel
          orgId={orgId}
          menu={menu}
          items={filteredItems}
          selectedCategoryName={selectedCategoryLabel}
          view={view}
          canManage={canManage}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          emptyStateText={
            searchQuery
              ? selectedTabId === null
                ? "No items match your search."
                : `No items match your search in ${selectedCategoryLabel}.`
              : selectedTabId === null
                ? "No items found."
                : undefined
          }
          totalCount={totalCount}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          sentinelRef={sentinelRef}
          searchQuery={searchQuery}
        />
      </div>
    </>
  );
}