"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { BackSidebarNavItem } from "@/components/layout/sidebar/back-sidebar-nav-item";
import { usePageSidebarSubContent } from "@/components/layout/contexts/page-sidebar-context";

export function NotesSidebarShell() {
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
      {subContent}
    </aside>
  );
}
