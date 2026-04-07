import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getTimetableTemplate } from "@/lib/services/templates";
import { prisma } from "@/lib/prisma";
import { Toolbar } from "@/components/layout/toolbar";
import {
  TemplateEditorClient,
  type ClientTemplateInstance,
  type ClientTask,
  type ClientMembership,
} from "./template-editor-client";
import { PermissionAction } from "@prisma/client";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TIMETABLE, {
    redirectTo: `/orgs/${orgId}/timetable`,
  });

  const [template, org, rawTasks, rawMemberships] = await Promise.all([
    getTimetableTemplate(orgId, templateId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { openTimeMin: true, closeTimeMin: true },
    }),
    prisma.task.findMany({
      where: { orgId },
      select: { id: true, name: true, durationMin: true },
      orderBy: { name: "asc" },
    }),
    prisma.membership.findMany({
      where: { orgId },
      select: { id: true, user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  if (!template) notFound();

  const instances: ClientTemplateInstance[] = template.entries.map((inst) => ({
    id: inst.id,
    dayIndex: inst.dayIndex,
    startTimeMin: inst.startTimeMin!,
    task: {
      id: inst.task.id,
      name: inst.task.name,
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
  }));

  const availableTasks: ClientTask[] = rawTasks;
  const memberships: ClientMembership[] = rawMemberships;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 148px)" }}>
      <Toolbar>
        <Link
          href={`/orgs/${orgId}/timetable/templates`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Templates
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <span className="font-semibold text-sm">{template.name}</span>
          <span className="text-xs text-muted-foreground">
            · {template.cycleLengthDays} day cycle
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
            Draft
          </span>
        </div>
      </Toolbar>

      <TemplateEditorClient
        orgId={orgId}
        templateId={templateId}
        templateDays={template.cycleLengthDays}
        instances={instances}
        availableTasks={availableTasks}
        memberships={memberships}
        openTimeMin={org?.openTimeMin ?? 360}
        closeTimeMin={org?.closeTimeMin ?? 1320}
        fillHeight
      />
    </div>
  );
}
