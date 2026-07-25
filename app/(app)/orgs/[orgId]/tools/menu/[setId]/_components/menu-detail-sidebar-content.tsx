"use client";

/**
 * Menu detail page sidebar controls.
 * Keeps the compact view switch and the add-category/add-item actions in the
 * same page-sidebar stack used by the rest of the tool pages.
 */

import { useActionSidebar } from "@/components/layout/contexts/action-sidebar-context";
import { ExternalLink, LayoutGrid, List, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuDetailActionsPanel } from "./menu-detail-actions-panel";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";
import { MenuSharePanel } from "./menu-share-panel";
import { FilterCombobox, type FilterComboboxItem } from "@/components/ui/comboboxes/filter-combobox";

/**
 * Menu detail page sidebar controls.
 * Keeps the view toggle and action buttons together in the page sidebar so
 * the layout matches the rest of the tool pages.
 */

type MenuDetailSidebarContentProps = {
  canManage: boolean;
  publicToken: string;
  previewClicksThisMonth: number;
  categoryItems: FilterComboboxItem[];
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  view: "card" | "list";
  onViewChange: (value: "card" | "list") => void;
  onAddCategory: () => void;
  onAddItem: () => void;
};

export function MenuDetailSidebarContent({
  canManage,
  publicToken,
  previewClicksThisMonth,
  categoryItems,
  selectedCategoryId,
  onCategorySelect,
  view,
  onViewChange,
  onAddCategory,
  onAddItem,
}: MenuDetailSidebarContentProps) {
  const { activeTitle, open } = useActionSidebar();
  const previewHref = `/menu/${publicToken}`;

  function handleOpenShare() {
    open(
      "Share",
      <MenuSharePanel
        publicToken={publicToken}
      />,
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2.5">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          View
        </p>

        <SegmentedControl
          value={view}
          onChange={onViewChange}
          options={[
            {
              value: "card",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Card
                </span>
              ),
            },
            {
              value: "list",
              label: (
                <span className="flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  List
                </span>
              ),
            },
          ]}
        />
      </div>

      <div className="border-t border-border px-3 pt-3 pb-2">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Filters
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <FilterCombobox
            items={categoryItems}
            selectedId={selectedCategoryId}
            allLabel="All categories"
            placeholder="Search categories…"
            onSelect={onCategorySelect}
            ariaLabel="Filter menu categories"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Share
        </p>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl" onClick={handleOpenShare}>
          <Share2 className="h-4 w-4" />
          Share menu
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Preview
        </p>
        <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-xl">
          <a href={previewHref} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Preview menu
          </a>
        </Button>
        <p className="px-1 text-xs text-sidebar-foreground/60">
          {previewClicksThisMonth} click{previewClicksThisMonth === 1 ? "" : "s"} this month
        </p>
      </div>
      <MenuDetailActionsPanel
        canManage={canManage}
        activeTitle={activeTitle}
        onAddCategory={onAddCategory}
        onAddItem={onAddItem}
      />
    </div>
  );
}