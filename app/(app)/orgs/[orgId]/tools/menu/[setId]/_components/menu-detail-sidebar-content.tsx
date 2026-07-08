"use client";

/**
 * Menu detail page sidebar controls.
 * Keeps the compact view switch and the add-category/add-item actions in the
 * same page-sidebar stack used by the rest of the tool pages.
 */

import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuDetailActionsPanel } from "./menu-detail-actions-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";

/**
 * Menu detail page sidebar controls.
 * Keeps the view toggle and action buttons together in the page sidebar so
 * the layout matches the rest of the tool pages.
 */

type MenuDetailSidebarContentProps = {
  canManage: boolean;
  publicToken: string;
  view: "card" | "list";
  onViewChange: (value: "card" | "list") => void;
  onAddCategory: () => void;
  onAddItem: () => void;
};

export function MenuDetailSidebarContent({
  canManage,
  publicToken,
  view,
  onViewChange,
  onAddCategory,
  onAddItem,
}: MenuDetailSidebarContentProps) {
  const { activeTitle } = useActionSidebar();
  const previewHref = `/menu/${publicToken}`;

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

      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          Preview
        </p>
        <Button asChild variant="outline" size="sm" className="w-full justify-center rounded-xl">
          <a href={previewHref} target="_blank" rel="noreferrer">
            Preview menu
          </a>
        </Button>
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