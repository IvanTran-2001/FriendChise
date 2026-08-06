"use client";

import { ArrowLeft, LayoutGrid } from "lucide-react";
import { BackSidebarNavItem } from "@/components/layout/sidebar/back-sidebar-nav-item";

export function ScanToTaskSidebarContent({ orgId }: { orgId: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
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
    </div>
  );
}