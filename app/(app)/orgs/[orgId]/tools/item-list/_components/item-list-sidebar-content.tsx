"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";

interface ItemListSidebarContentProps {
  orgId: string;
  canManage: boolean;
  view: "grid" | "list";
  onCreateItem: () => void;
}

export function ItemListSidebarContent({
  orgId,
  canManage,
  view,
  onCreateItem,
}: ItemListSidebarContentProps) {
  const router = useRouter();
  const { activeTitle } = useActionSidebar();
  const base = `/orgs/${orgId}/tools/item-list`;

  function buildHref(overrides: { view?: "grid" | "list" }) {
    const params = new URLSearchParams();
    const next = { view, ...overrides };
    if (next.view && next.view !== "grid") params.set("view", next.view);
    const qs = params.toString();
    return `${base}${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      {/* View toggle */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2 border-t border-border">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          View
        </span>
        <SegmentedControl
          value={view}
          onChange={(v) => router.push(buildHref({ view: v as "grid" | "list" }))}
          options={[
            { value: "grid", label: <span className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" />Grid</span> },
            { value: "list", label: <span className="flex items-center gap-1.5"><List className="h-3.5 w-3.5" />List</span> },
          ]}
        />
      </div>

      {/* Actions */}
      {canManage && (
        <div className="px-3 py-3 flex flex-col gap-2 border-t border-border">
          <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
            Actions
          </span>
          <Button
            size="sm"
            variant={activeTitle === "New Item" ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={onCreateItem}
          >
            <Plus className="h-4 w-4" />
            New Item
          </Button>
        </div>
      )}
    </>
  );
}

