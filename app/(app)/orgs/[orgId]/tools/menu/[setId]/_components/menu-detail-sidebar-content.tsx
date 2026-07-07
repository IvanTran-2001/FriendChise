"use client";

/**
 * Menu detail page sidebar controls.
 * Keeps the compact view switch and the add-category/add-item actions in the
 * same page-sidebar stack used by the rest of the tool pages.
 */

import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { LayoutGrid, List } from "lucide-react";
import { MenuDetailActionsPanel } from "./menu-detail-actions-panel";

/**
 * Menu detail page sidebar controls.
 * Keeps the view toggle and action buttons together in the page sidebar so
 * the layout matches the rest of the tool pages.
 */

type MenuDetailSidebarContentProps = {
  canManage: boolean;
  view: "card" | "list";
  onViewChange: (value: "card" | "list") => void;
  onAddCategory: () => void;
  onAddItem: () => void;
};

export function MenuDetailSidebarContent({
  canManage,
  view,
  onViewChange,
  onAddCategory,
  onAddItem,
}: MenuDetailSidebarContentProps) {
  const { activeTitle } = useActionSidebar();

  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          View
        </p>

        {/* Keep this toggle content-sized so it reads like a sidebar control. */}
        <div className="inline-flex w-fit overflow-hidden rounded-full border border-border/70 bg-muted/35 p-0.5 text-xs font-medium shadow-sm self-start">
          <button
            type="button"
            onClick={() => onViewChange("card")}
            aria-pressed={view === "card"}
            className={[
              "inline-flex h-8 items-center justify-center rounded-full px-3 transition-all duration-150 cursor-pointer select-none whitespace-nowrap leading-none",
              view === "card"
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            ].join(" ")}
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Card
            </span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
            className={[
              "inline-flex h-8 items-center justify-center rounded-full px-3 transition-all duration-150 cursor-pointer select-none whitespace-nowrap leading-none",
              view === "list"
                ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            ].join(" ")}
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List
            </span>
          </button>
        </div>
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