"use client";

/**
 * Menu detail view panel.
 * Renders the compact view toggle used by the menu page sidebar so the list
 * and card layouts stay page-local instead of living in the toolbar.
 */

import type { ReactElement, ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";

type ViewOption = {
  value: "card" | "list";
  label: ReactNode;
};

const ContentSizedSegmentedControl = SegmentedControl as unknown as (
  props: {
  value: "card" | "list";
  onChange: (value: "card" | "list") => void;
  options: ViewOption[];
  className?: string;
  disabled?: boolean;
  multiple?: false;
  },
) => ReactElement;

export function MenuDetailViewPanel({
  view,
  onViewChange,
}: {
  view: "card" | "list";
  onViewChange: (value: "card" | "list") => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
        View
      </p>

      <ContentSizedSegmentedControl
        multiple={false}
        value={view}
        onChange={(value) => onViewChange(value)}
        options={[
          {
            value: "card",
            label: (
              <span className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Card
              </span>
            ),
          },
          {
            value: "list",
            label: (
              <span className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List
              </span>
            ),
          },
        ]}
        className="w-fit self-start"
      />
    </div>
  );
}