"use client";

/**
 * Menu detail actions panel.
 * Holds the add-category and add-item buttons that open action-sidebar forms
 * for the current menu.
 */

import { FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MenuDetailActionsPanel({
  canManage,
  activeTitle,
  onAddCategory,
  onAddItem,
}: {
  canManage: boolean;
  activeTitle: string | null;
  onAddCategory: () => void;
  onAddItem: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Actions
      </p>
      {canManage && (
        <>
          <Button
            variant={activeTitle === "Add Category" ? "default" : "outline"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onAddCategory}
          >
            <FolderPlus className="h-4 w-4" />
            Add Category
          </Button>
          <Button
            variant={activeTitle === "Add Item" ? "default" : "outline"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onAddItem}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </>
      )}
    </div>
  );
}