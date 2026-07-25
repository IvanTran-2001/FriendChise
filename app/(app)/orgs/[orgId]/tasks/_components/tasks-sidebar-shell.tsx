"use client";

import { usePageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";

export function TasksSidebarShell() {
  const subContent = usePageSidebarSubContent();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}
