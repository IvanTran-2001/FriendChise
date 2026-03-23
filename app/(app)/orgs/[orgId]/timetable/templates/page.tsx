import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { requireOrgMember } from "@/lib/authz";
import { getTimetableTemplates } from "@/lib/services/templates";
import { Toolbar } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  const templates = await getTimetableTemplates(orgId);

  return (
    <>
      <Toolbar>
        <Link href={`/orgs/${orgId}/timetable/templates/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Template
          </Button>
        </Link>
      </Toolbar>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            No templates yet. Create one to get started.
          </p>
          <Link href={`/orgs/${orgId}/timetable/templates/new`}>
            <Button variant="outline" size="sm">
              Create Template
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/orgs/${orgId}/timetable/templates/${t.id}`}
            >
              <div className="rounded-xl border p-4 hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="font-semibold text-sm">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>{t.templateDays} days</span>
                  <span>·</span>
                  <span>{t._count.instances} slots</span>
                  <span>·</span>
                  {(() => {
                    const now = new Date();
                    const isActive =
                      !!t.effectiveFrom && t.effectiveFrom <= now;
                    const isScheduled =
                      !!t.effectiveFrom && t.effectiveFrom > now;
                    return (
                      <span
                        className={
                          isActive
                            ? "text-green-600 font-medium"
                            : isScheduled
                              ? "text-amber-600 font-medium"
                              : "text-slate-400"
                        }
                      >
                        {isActive
                          ? "Active"
                          : isScheduled
                            ? "Scheduled"
                            : "Draft"}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
