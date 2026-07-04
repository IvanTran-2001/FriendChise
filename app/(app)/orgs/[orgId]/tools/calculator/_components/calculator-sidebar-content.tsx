/**
 * CalculatorSidebarContent — page sidebar for `/orgs/[orgId]/tools/calculator`.
 *
 * Shows the tool title and a Back link to the Tools hub.
 */
"use client";

import { ArrowLeft } from "lucide-react";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";

export function CalculatorSidebarContent({ orgId }: { orgId: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back */}
      <PageSidebarNavItem
        title="Back"
        url={`/orgs/${orgId}/tools`}
        icon={ArrowLeft}
        isActive={false}
        ignoreRemembered={true}
      />
    </div>
  );
}
