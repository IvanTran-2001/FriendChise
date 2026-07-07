"use client";

/**
 * Menu sidebar content.
 * Provides the top-level New Menu action for the menu list page sidebar.
 */

import { MenuSidebarActionsPanel } from "./menu-sidebar-actions-panel";

export function MenuSidebarContent({
  canManage,
  onCreateMenu,
}: {
  orgId: string;
  canManage: boolean;
  onCreateMenu: () => void;
}) {
  return <MenuSidebarActionsPanel canManage={canManage} onCreateMenu={onCreateMenu} />;
}