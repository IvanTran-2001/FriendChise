"use client";

/**
 * Menu sidebar shell.
 * Bridges the shared page-sidebar container to the menu-specific sidebar
 * controls and back navigation.
 */

import { useParams } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { BackSidebarNavItem } from "@/components/layout/back-sidebar-nav-item";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";

export function MenuSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const subContent = usePageSidebarSubContent();

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      <BackSidebarNavItem
        title="Back"
        fallbackHref={`/orgs/${orgId}/tools`}
        icon={ArrowLeft}
        secondaryButton={{
          title: "Toolhub",
          href: `/orgs/${orgId}/tools`,
          icon: LayoutGrid,
        }}
      />

      {/* Page-specific sub-content lives below the shared tab row. */}
      {subContent}
    </aside>
  );
}
