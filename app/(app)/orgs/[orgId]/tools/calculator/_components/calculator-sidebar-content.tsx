/**
 * CalculatorSidebarContent — page sidebar for `/orgs/[orgId]/tools/calculator`.
 *
 * Shows the tool title and a Back link to the Tools hub.
 */
"use client";

import { ArrowLeft } from "lucide-react";
import { LayoutGrid } from "lucide-react";
import { BackSidebarNavItem } from "@/components/layout/back-sidebar-nav-item";

export function CalculatorSidebarContent({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back */}
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
