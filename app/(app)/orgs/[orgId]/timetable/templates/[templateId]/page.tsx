import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireOrgMember } from "@/lib/authz";
import { getTimetableTemplate } from "@/lib/services/templates";
import { prisma } from "@/lib/prisma";
import { Toolbar } from "@/components/layout/toolbar";
import {
  TemplateEditorClient,
  type ClientTemplateInstance,
  type ClientTask,
  type ClientMembership,
} from "./template-editor-client";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  const [template, org, rawTasks, rawMemberships] = await Promise.all([
    getTimetableTemplate(orgId, templateId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { openTimeMin: true, closeTimeMin: true },
    }),
    prisma.task.findMany({
      where: { orgId },
      select: { id: true, title: true, durationMin: true },
      orderBy: { title: "asc" },
    }),
    prisma.membership.findMany({
      where: { orgId },
      select: { id: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  if (!template) notFound();

  const instances: ClientTemplateInstance[] = template.instances.map(
    (inst) => ({
      id: inst.id,
      dayOffset: inst.dayOffset!,
      startTimeMin: inst.startTimeMin!,
      task: {
        id: inst.task.id,
        title: inst.task.title,
        durationMin: inst.task.durationMin,
      },
      assignees: inst.assignees.map((a) => ({
        id: a.id,
        membership: {
          id: a.membership.id,
          user: {
            id: a.membership.user.id,
            name: a.membership.user.name,
          },
        },
      })),
    }),
  );

  const availableTasks: ClientTask[] = rawTasks;
  const memberships: ClientMembership[] = rawMemberships;

  const now = new Date();
  const isActive = !!template.effectiveFrom && template.effectiveFrom <= now;
  const isScheduled = !!template.effectiveFrom && template.effectiveFrom > now;
  const statusLabel = isActive ? "Active" : isScheduled ? "Scheduled" : "Draft";

  return (
    <>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/timetable/templates`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Templates
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <span className="font-semibold text-sm">{template.title}</span>
          <span className="text-xs text-muted-foreground">
            · {template.templateDays} day cycle
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              isActive
                ? "bg-green-100 text-green-700"
                : isScheduled
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </Toolbar>

      <TemplateEditorClient
        orgId={orgId}
        templateId={templateId}
        templateDays={template.templateDays}
        instances={instances}
        availableTasks={availableTasks}
        memberships={memberships}
        openTimeMin={org?.openTimeMin ?? 360}
        closeTimeMin={org?.closeTimeMin ?? 1320}
      />
    </>
  );
}
