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
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, LayoutTemplate, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { AddItemForm } from "./add-item-form";
import { AddRateForm } from "./add-rate-form";
import { AddTemplateForm } from "./add-template-form";

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
}

export function SetSidebarContent({
  orgId,
  setId,
  setName,
  toolItems,
  rates,
  templates,
}: SetSidebarContentProps) {
  const { open, close, activeTitle } = useActionSidebar();
  const keyRef = useRef(0);

  function openPanel(title: string, content: React.ReactNode) {
    const k = ++keyRef.current;
    open(title, <div key={k} className="p-4">{content}</div>);
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
      {/* Title */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider truncate">
          {setName}
        </span>
      </div>

      {/* Back */}
      <Link
        href={`/orgs/${orgId}/tools/conversion`}
        className="flex items-center gap-2 h-12 px-4 text-sm border-b border-border text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors shrink-0"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Back
      </Link>

      {/* Actions */}
      <div className="px-3 py-3 flex flex-col gap-2">
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
      </div>
    </div>
  );
}
