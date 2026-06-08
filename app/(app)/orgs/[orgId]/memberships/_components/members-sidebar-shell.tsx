"use client";

import { useParams, usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";

export function MembersSidebarShell() {
  const { orgId } = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const subContent = usePageSidebarSubContent();

  const membershipsHref = `/orgs/${orgId}/memberships`;

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      {/* Nav tab */}
      <nav className="shrink-0 border-b border-border">
        <PageSidebarNavItem
          title="List"
          url={membershipsHref}
          icon={Users}
          isActive={pathname === membershipsHref}
        />
      </nav>

      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}