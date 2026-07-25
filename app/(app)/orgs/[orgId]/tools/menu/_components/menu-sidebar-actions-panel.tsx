"use client";

/**
 * Menu sidebar actions.
 * Exposes the primary New Menu button and keeps the sidebar action state in
 * sync with the active action-sidebar panel.
 */

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MenuSidebarActionsPanel({
  canManage,
  onCreateMenu,
}: {
  canManage: boolean;
  onCreateMenu: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        Actions
      </p>
      {canManage && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onCreateMenu}
        >
          <Plus className="h-4 w-4" />
          New Menu
        </Button>
      )}
    </div>
  );
}