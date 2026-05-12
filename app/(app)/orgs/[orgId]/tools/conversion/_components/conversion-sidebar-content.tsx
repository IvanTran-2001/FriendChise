/**
 * ConversionSidebarContent — page sidebar for `/orgs/[orgId]/tools/conversion`.
 *
 * Shows the tool title, a Back link to the Tools hub, and an "Add Set" action
 * button that opens `AddSetForm` in the ActionSidebar.
 * The button variant switches to `default` when its panel is active.
 */
"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { AddSetForm } from "./add-set-form";

export function ConversionSidebarContent({ orgId }: { orgId: string }) {
  const { open, close, activeTitle } = useActionSidebar();
  const formKeyRef = useRef(0);

  function handleAddSet() {
    const k = ++formKeyRef.current;
    open(
      "Add Set",
      <div key={k} className="p-4">
        <AddSetForm orgId={orgId} onSuccess={close} onCancel={close} />
      </div>,
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title row */}
      <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          Conversion
        </span>
      </div>

      {/* Back */}
      <Link
        href={`/orgs/${orgId}/tools`}
        className="flex items-center gap-2 h-12 px-4 text-sm border-b border-border text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Actions */}
      <div className="px-3 py-3 flex flex-col gap-2">
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
          Actions
        </span>
        <Button
          size="sm"
          variant={activeTitle === "Add Set" ? "default" : "outline"}
          className="w-full justify-start gap-2"
          onClick={handleAddSet}
        >
          <Plus className="h-4 w-4" />
          Add Set
        </Button>
      </div>
    </div>
  );
}
