"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface TemplatesSidebarContentProps {
  orgId: string;
  view: "card" | "list";
  listHref: string;
  cardHref: string;
}

export function TemplatesSidebarContent({
  orgId,
  view,
  listHref,
  cardHref,
}: TemplatesSidebarContentProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Actions section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          Actions
        </p>
        <Button asChild size="sm" className="gap-1.5 w-full justify-start">
          <Link href={`/orgs/${orgId}/timetable/templates/new`}>
            <Plus className="h-3.5 w-3.5" /> New Template
          </Link>
        </Button>
      </div>

      {/* View section */}
      <div className="px-3 pt-2 pb-3 border-t border-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
          View
        </p>
        <SegmentedControl
          size="sm"
          className="w-fit"
          value={view}
          onChange={(v) => router.push(v === "list" ? listHref : cardHref)}
          options={[
            { value: "list", label: <List className="h-4 w-4" /> },
            { value: "card", label: <LayoutGrid className="h-4 w-4" /> },
          ]}
        />
      </div>
    </div>
  );
}
