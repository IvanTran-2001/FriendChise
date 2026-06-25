"use client";

import { useParams, usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import { usePageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";

export function AnnouncementSidebarShell() {
  const subContent = usePageSidebarSubContent();
  const pathname = usePathname();
  const { orgId } = useParams<{ orgId: string }>();

  const navUrl = `/orgs/${orgId}/announcements`;
  const isActive = pathname === navUrl || pathname.startsWith(`${navUrl}/`);

  return (
    <aside className="flex flex-col flex-1 overflow-y-auto">
      <nav className="shrink-0 border-b border-border">
        <PageSidebarNavItem
          title="Updates"
          url={navUrl}
          icon={Megaphone}
          isActive={isActive}
        />
      </nav>

      {/* Page-specific sub-content (filters, actions, etc.) */}
      {subContent}
    </aside>
  );
}
