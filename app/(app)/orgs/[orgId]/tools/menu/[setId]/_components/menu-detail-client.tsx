"use client";

/**
 * Menu detail page client.
 * Owns the toolbar filters, sidebar actions, and the menu item view mode so
 * the menu page can swap between card and list layouts without losing state.
 */

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { SearchableCombobox, type ComboboxItem } from "@/components/ui/searchable-combobox";
import { MenuDetailSidebarContent } from "./menu-detail-sidebar-content";
import { AddMenuCategoryPanel } from "./add-menu-category-panel";
import { AddMenuItemPanel } from "./add-menu-item-panel";
import { MenuDetailHeader } from "./menu-detail-header";
import { MenuItemsPanel } from "./menu-items-panel";
import { deleteMenuItemAction } from "@/app/actions/tools";
import type { MenuDetail, ToolItemOption } from "@/lib/services/tools/menus";

export function MenuDetailClient({
  orgId,
  menu,
  canManage,
  toolItems,
}: {
  orgId: string;
  menu: MenuDetail;
  canManage: boolean;
  toolItems: ToolItemOption[];
}) {
  const { open, close } = useActionSidebar();
  const openKeyRef = useRef(0);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "list">("card");

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

  const categoryItems = useMemo<ComboboxItem[]>(
    () => [
      { id: "__all__", name: "ALL" },
      ...menu.tabs.map((tab) => ({ id: tab.id, name: tab.name })),
    ],
    [menu.tabs],
  );

  const visibleItems = useMemo(() => {
    if (!selectedTab) return menu.items;
    return selectedTab.placements.map((placement) => placement.menuItem);
  }, [menu.items, selectedTab]);

  const selectedCategoryLabel = selectedTab?.name ?? "ALL";

  function handleAddItem() {
    const key = ++openKeyRef.current;
    open(
      "Add Item",
      <AddMenuItemPanel
        key={key}
        orgId={orgId}
        menuId={menu.id}
        toolItems={toolItems}
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
        toolItems={toolItems}
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
      "Add Category",
      <AddMenuCategoryPanel
        key={key}
        orgId={orgId}
        menuId={menu.id}
        onClose={close}
      />,
    );
  }

  return (
    <>
      <RegisterPageToolbar>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-xs min-w-0 flex-1">
            <SearchableCombobox
              items={categoryItems}
              triggerLabel={selectedCategoryLabel}
              placeholder="Search categories…"
              emptyText="No categories"
              onSelect={(item) => {
                setSelectedTabId(item.id === "__all__" ? null : item.id);
              }}
            />
          </div>
        </div>
      </RegisterPageToolbar>

      <RegisterPageSidebarSubContent
        content={
          <MenuDetailSidebarContent
            canManage={canManage}
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
          items={visibleItems}
          selectedCategoryName={selectedCategoryLabel}
          view={view}
          canManage={canManage}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      </div>
    </>
  );
}