"use client";

import { ArrowLeft, LayoutGrid } from "lucide-react";
import { BackSidebarNavItem } from "@/components/layout/sidebar/back-sidebar-nav-item";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";
import { usePersistedState } from "@/hooks/use-persisted-state";

export function ScanToTaskSidebarContent({ orgId }: { orgId: string }) {
  const [view, setView] = usePersistedState<"feed" | "list">(
    `scan-to-task:${orgId}:view`,
    "feed",
  );

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

      <div className="border-t border-border px-3 py-3">
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
          View
        </p>
        <SegmentedControl<"feed" | "list">
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: "Feed" },
            { value: "list", label: "List" },
          ]}
        />
      </div>
    </div>
  );
}