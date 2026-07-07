"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, LayoutTemplate, Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackSidebarNavItem } from "@/components/layout/back-sidebar-nav-item";
import { PageSidebarNavItem } from "@/components/layout/page-sidebar-nav-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";
import { createRosterTemplateAction } from "@/app/actions/roster";

function AddTemplatePanel({ orgId }: { orgId: string }) {
  const [name, setName] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [isPending, startTransition] = useTransition();
  const sidebar = useActionSidebar();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createRosterTemplateAction(
        orgId,
        name.trim(),
        weeks,
      );
      if (!result.ok) {
        toast.error(result.error ?? "Failed to create template");
        return;
      }
      toast.success("Template created");
      sidebar.close();
      router.push(`/orgs/${orgId}/tools/roster/templates/${result.templateId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          autoFocus
          placeholder="e.g. Default Week"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Cycle length (weeks)
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setWeeks((w) => Math.max(1, w - 1))}
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-medium tabular-nums">
            {weeks}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setWeeks((w) => Math.min(12, w + 1))}
          >
            +
          </Button>
          <span className="text-xs text-muted-foreground">
            {weeks === 1 ? "single week" : `${weeks}-week cycle`}
          </span>
        </div>
      </div>

      <Button type="submit" disabled={!name.trim() || isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Create template"
        )}
      </Button>
    </form>
  );
}

interface RosterTemplatesSidebarContentProps {
  orgId: string;
  canManage: boolean;
}

export function RosterTemplatesSidebarContent({
  orgId,
  canManage,
}: RosterTemplatesSidebarContentProps) {
  const sidebar = useActionSidebar();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back to roster */}
      <BackSidebarNavItem
        title="Back"
        fallbackHref={`/orgs/${orgId}/tools/roster`}
        icon={ArrowLeft}
      />

      {/* Templates (active) */}
      <PageSidebarNavItem
        title="Templates"
        url={`/orgs/${orgId}/tools/roster/templates`}
        icon={LayoutTemplate}
        isActive={true}
      />

      {/* Actions */}
      {canManage && (
        <div className="px-3 pt-3 pb-3 border-t border-border">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1 mb-2">
            Actions
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() =>
              sidebar.open("New template", <AddTemplatePanel orgId={orgId} />)
            }
          >
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        </div>
      )}
    </div>
  );
}
