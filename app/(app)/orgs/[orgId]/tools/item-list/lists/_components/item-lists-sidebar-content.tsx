"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";

interface ItemListsSidebarContentProps {
  orgId: string;
  canManage: boolean;
  view: "list" | "card";
  /** Callback to open the Create List panel — lifted to ItemListsPageClient so the new list updates shared state immediately. */
  onCreateList: () => void;
}

export function ItemListsSidebarContent({ orgId, canManage, view, onCreateList }: ItemListsSidebarContentProps) {
  const router = useRouter();
  const { activeTitle } = useActionSidebar();
  const base = `/orgs/${orgId}/tools/item-list/lists`;

  function buildHref(v: "list" | "card") {
    return v === "list" ? base : `${base}?view=card`;
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
          onChange={(v) => router.push(buildHref(v as "list" | "card"))}
          options={[
            {
              value: "list",
              label: (
                <span className="flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  List
                </span>
              ),
            },
            {
              value: "card",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Card
                </span>
              ),
            },
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
            variant={activeTitle === "New List" ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={onCreateList}
          >
            <Plus className="h-4 w-4" />
            New Set
          </Button>
        </div>
      )}
    </>
  );
}
