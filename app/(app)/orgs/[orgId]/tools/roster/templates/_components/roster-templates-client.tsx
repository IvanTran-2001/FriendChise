"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteRosterTemplateAction } from "@/app/actions/roster";
import { useActionSidebar } from "@/components/layout/action-sidebar-context";

type TemplateRow = {
  id: string;
  name: string;
  cycleWeeks: number;
  _count: { entries: number };
};

function ConfirmDeletePanel({
  orgId,
  templateId,
  name,
}: {
  orgId: string;
  templateId: string;
  name: string;
}) {
  const [isPending, startTransition] = useTransition();
  const sidebar = useActionSidebar();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRosterTemplateAction(orgId, templateId);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete template");
        return;
      }
      toast.success("Template deleted");
      sidebar.close();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        Delete <span className="font-semibold text-foreground">{name}</span>?
        This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => sidebar.close()}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
        </Button>
      </div>
    </div>
  );
}

interface RosterTemplatesClientProps {
  orgId: string;
  templates: TemplateRow[];
  canManage: boolean;
}

export function RosterTemplatesClient({
  orgId,
  templates,
  canManage,
}: RosterTemplatesClientProps) {
  const sidebar = useActionSidebar();
  const router = useRouter();

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <LayoutTemplate className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No templates yet</p>
        {canManage && (
          <p className="text-xs text-muted-foreground/60">
            Use the sidebar to create your first template.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => (
        <div
          key={t.id}
          className="group relative flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
        >
          <Link
            href={`/orgs/${orgId}/tools/roster/templates/${t.id}`}
            className="absolute inset-0 rounded-xl"
            aria-label={`Open template ${t.name}`}
          />

          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-sm truncate">{t.name}</span>
            </div>

            {canManage && (
              <div className="relative flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  title="Edit"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(
                      `/orgs/${orgId}/tools/roster/templates/${t.id}`,
                    );
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title="Delete"
                  onClick={(e) => {
                    e.preventDefault();
                    sidebar.open(
                      "Delete template",
                      <ConfirmDeletePanel
                        orgId={orgId}
                        templateId={t.id}
                        name={t.name}
                      />,
                    );
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {t.cycleWeeks === 1 ? "1-week cycle" : `${t.cycleWeeks}-week cycle`}
            {" · "}
            {t._count.entries} {t._count.entries === 1 ? "entry" : "entries"}
          </p>
        </div>
      ))}
    </div>
  );
}
