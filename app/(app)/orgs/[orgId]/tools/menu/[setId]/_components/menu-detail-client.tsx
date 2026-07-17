"use client";

/**
 * Menu detail page client.
 * Owns the toolbar filters, sidebar actions, and the menu item view mode so
 * the menu page can swap between card and list layouts without losing state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/contexts/toolbar-context";
import { Input } from "@/components/ui/input";
import { type FilterComboboxItem } from "@/components/ui/comboboxes/filter-combobox";
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
  const router = useRouter();
  const openKeyRef = useRef(0);
  const requestSeqRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "list">("card");
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [allItems, setAllItems] = useState(menu.items);
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(menu.itemsPage ?? 1);
  const [totalPages, setTotalPages] = useState(menu.itemsTotalPages ?? 1);
  const [totalCount, setTotalCount] = useState(menu.itemsTotalCount ?? menu.items.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const menuIdRef = useRef(menu.id);

  const itemDefaultTabAssignments = useMemo(() => {
    const map = new Map<string, { tabId: string; priceOverride: number | null }[]>();

    for (const tab of menu.tabs) {
      for (const placement of tab.placements) {
        const current = map.get(placement.menuItem.id) ?? [];
        current.push({
          tabId: tab.id,
          priceOverride: placement.priceOverride ?? null,
        });
        map.set(placement.menuItem.id, current);
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

    return selectedTab.placements
      .map((placement) => placement.menuItem)
      .filter((item) => !deletedItemIds.has(item.id));
  }, [allItems, deletedItemIds, selectedTab]);

  const selectedTabPriceByItemId = useMemo(() => {
    if (!selectedTab) return undefined;

    return Object.fromEntries(
      selectedTab.placements.map((placement) => [
        placement.menuItem.id,
        placement.priceOverride ?? placement.menuItem.price,
      ]),
    ) as Record<string, number | null>;
  }, [selectedTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearch.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [itemSearch]);

  const filteredItems = useMemo(() => {
    const query = debouncedItemSearch.toLowerCase();
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
  }, [debouncedItemSearch, visibleItems]);

  const selectedCategoryLabel = selectedTab?.name ?? "ALL";
  const selectedCategoryId = selectedTabId;
  const searchQuery = debouncedItemSearch;
  const isSearchingAllItems = selectedTabId === null && searchQuery.length > 0;

  const hasMore = selectedTabId === null && page < totalPages;

  useEffect(() => {
    if (selectedTabId !== null) return;

    requestSeqRef.current += 1;
    setDeletedItemIds(new Set());

    if (searchQuery.length === 0) {
      setAllItems(menu.items);
      setPage(menu.itemsPage ?? 1);
      setTotalPages(menu.itemsTotalPages ?? 1);
      setTotalCount(menu.itemsTotalCount ?? menu.items.length);
      return;
    }

    setAllItems([]);
    setPage(0);
    setTotalPages(1);
    setTotalCount(0);
  }, [
    menu.id,
    menu.items,
    menu.itemsPage,
    menu.itemsTotalCount,
    menu.itemsTotalPages,
    searchQuery,
    selectedTabId,
  ]);

  useEffect(() => {
    if (menuIdRef.current === menu.id) return;

    menuIdRef.current = menu.id;
    setAllItems(menu.items);
    setDeletedItemIds(new Set());
    setPage(menu.itemsPage ?? 1);
    setTotalPages(menu.itemsTotalPages ?? 1);
    setTotalCount(menu.itemsTotalCount ?? menu.items.length);
  }, [menu.id, menu.items, menu.itemsPage, menu.itemsTotalCount, menu.itemsTotalPages]);

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
      if (searchQuery.length > 0) params.set("search", searchQuery);

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
        for (const item of data.items) {
          if (!deletedItemIds.has(item.id)) nextItems.set(item.id, item);
        }
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
  }, [deletedItemIds, isLoadingMore, menu.id, menu.itemsPageSize, orgId, page, searchQuery, selectedTabId, totalPages]);

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
        menuItems={allItems}
        itemDefaultTabAssignments={itemDefaultTabAssignments}
        tabs={menu.tabs.map((tab) => ({ id: tab.id, name: tab.name }))}
        defaultTabId={selectedTabId}
        defaultTabAssignments={
          selectedTabId ? [{ tabId: selectedTabId, priceOverride: null }] : []
        }
        onSwitchToEdit={(item, draft) => {
          const editKey = ++openKeyRef.current;
          open(
            "Edit Item",
            <AddMenuItemPanel
              key={editKey}
              orgId={orgId}
              menuId={menu.id}
              menuItems={allItems}
              itemDefaultTabAssignments={itemDefaultTabAssignments}
              tabs={menu.tabs.map((tab) => ({ id: tab.id, name: tab.name }))}
              defaultTabId={selectedTabId}
              defaultTabAssignments={draft.selectedTabAssignments.map((assignment) => ({
                tabId: assignment.tabId,
                priceOverride: assignment.priceOverride.trim() === "" ? null : Number(assignment.priceOverride),
              }))}
              initialItem={item}
              prefill={draft}
              mode="edit"
              onClose={close}
            />,
          );
        }}
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
        menuItems={allItems}
        itemDefaultTabAssignments={itemDefaultTabAssignments}
        tabs={menu.tabs.map((tab) => ({ id: tab.id, name: tab.name }))}
        defaultTabId={selectedTabId}
        defaultTabAssignments={itemDefaultTabAssignments.get(item.id) ?? []}
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
    setDeletedItemIds((current) => new Set(current).add(item.id));
    setAllItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setTotalCount((current) => Math.max(current - 1, 0));
    router.refresh();
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
          priceByItemId={selectedTabPriceByItemId}
        />
      </div>
    </>
  );
}