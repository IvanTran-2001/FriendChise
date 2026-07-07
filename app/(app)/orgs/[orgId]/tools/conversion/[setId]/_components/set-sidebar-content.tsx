/**
 * SetSidebarContent — page sidebar for the `/orgs/[orgId]/tools/conversion/[setId]` page.
 *
 * Provides three action buttons that open panels in the ActionSidebar:
 *   - **Items** — create org-scoped ToolItems (name + unit)
 *   - **Rates** — define conversion rates between items in this set
 *   - **Templates** — create, switch, and delete named calculator presets
 *
 * Each button highlights when its panel is active (matched by `activeTitle`).
 * The `keyRef` increments on every open so React re-mounts the form even if
 * the same panel is reopened — clearing any dirty input state.
 */
"use client";

import { useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  ClipboardList,
  LayoutGrid,
  LayoutTemplate,
  List,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BackSidebarNavItem } from "@/components/layout/back-sidebar-nav-item";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { AddItemForm } from "./add-item-form";
import { AddRateForm } from "./add-rate-form";
import { AddTemplateForm } from "./add-template-form";
import { ApplyListPanel } from "./apply-list-panel";

type ToolItem = { id: string; name: string; unit: string };
type Rate = {
  id: string;
  fromQty: number;
  toQty: number;
  fromItem: ToolItem;
  toItem: ToolItem;
};
type Template = { id: string; name: string };

interface SetSidebarContentProps {
  orgId: string;
  setId: string;
  setName: string;
  toolItems: ToolItem[];
  rates: Rate[];
  templates: Template[];
  lists: { id: string; name: string }[];
  activeTemplateId: string | null;
  view: "card" | "list";
}

export function SetSidebarContent({
  orgId,
  setId,
  setName: _setName,
  toolItems,
  rates,
  templates,
  lists,
  activeTemplateId,
  view,
}: SetSidebarContentProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const keyRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openPanel(title: string, content: React.ReactNode) {
    const k = ++keyRef.current;
    open(
      title,
      <div key={k} className="p-4">
        {content}
      </div>,
    );
  }

  function handleItems() {
    openPanel(
      "Items",
      <AddItemForm
        orgId={orgId}
        toolItems={toolItems}
        onSuccess={() => {}}
        onCancel={close}
      />,
    );
  }

  function handleRates() {
    openPanel(
      "Rates",
      <AddRateForm
        orgId={orgId}
        setId={setId}
        toolItems={toolItems}
        rates={rates}
        onClose={close}
      />,
    );
  }

  function handleTemplates() {
    openPanel(
      "Templates",
      <AddTemplateForm
        orgId={orgId}
        setId={setId}
        templates={templates}
        onClose={close}
      />,
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back */}
      <BackSidebarNavItem
        title="Back"
        fallbackHref={`/orgs/${orgId}/tools/conversion`}
        icon={ArrowLeft}
      />

      {/* View */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2 border-t border-border">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          View
        </span>
        <SegmentedControl
          value={view}
          onChange={(v) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("view", v);
            router.push(`${pathname}?${params.toString()}`);
          }}
          options={[
            {
              value: "card",
              label: (
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Card
                </span>
              ),
            },
            {
              value: "list",
              label: (
                <span className="flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  List
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="px-3 py-3 flex flex-col gap-2 border-t">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          Actions
        </span>
        <Button
          size="sm"
          variant={activeTitle === "Items" ? "default" : "outline"}
          className="w-full justify-start gap-2"
          onClick={handleItems}
        >
          <Package className="h-3.5 w-3.5 shrink-0" />
          Items
        </Button>
        <Button
          size="sm"
          variant={activeTitle === "Rates" ? "default" : "outline"}
          className="w-full justify-start gap-2"
          onClick={handleRates}
        >
          <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
          Rates
        </Button>
        <Button
          size="sm"
          variant={activeTitle === "Templates" ? "default" : "outline"}
          className="w-full justify-start gap-2"
          onClick={handleTemplates}
        >
          <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
          Templates
        </Button>
        {activeTemplateId && lists.length > 0 && (
          <Button
            size="sm"
            variant={activeTitle === "Apply List" ? "default" : "outline"}
            className="w-full justify-start gap-2"
            onClick={() => {
              const k = ++keyRef.current;
              open(
                "Apply List",
                <ApplyListPanel
                  key={k}
                  orgId={orgId}
                  setId={setId}
                  templateId={activeTemplateId}
                  lists={lists}
                  onApplied={() => {
                    close();
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("t", Date.now().toString());
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  onClose={close}
                />,
              );
            }}
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0" />
            Apply List
          </Button>
        )}
      </div>
    </div>
  );
}
