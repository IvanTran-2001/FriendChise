import { notFound } from "next/navigation";
import { requireOrgPermissionPage } from "@/lib/authz";
import { getTimetableTemplate } from "@/lib/services/templates";
import { getTasks } from "@/lib/services/tasks";
import { prisma } from "@/lib/prisma";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { TemplateEditorSidebarContent } from "./_components/template-editor-sidebar-content";
import {
  TemplateEditorClient,
  type ClientTemplateInstance,
  type ClientTask,
  type ClientMembership,
} from "./template-editor-client";
import { PermissionAction } from "@prisma/client";

export default async function TemplateEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
  searchParams: Promise<{ mode?: string; span?: string }>;
}) {
  const { orgId, templateId } = await params;
  const sp = await searchParams;
  const mode: "calendar" | "simple" =
    sp.mode === "simple" ? "simple" : "calendar";
  const span: "day" | "week" = sp.span === "day" ? "day" : "week";

  const editorHref = (overrides: { mode?: string; span?: string }) => {
    const next = { mode, span, ...overrides };
    const params = new URLSearchParams();
    if (next.mode !== "calendar") params.set("mode", next.mode);
    if (next.span !== "week") params.set("span", next.span);
    const qs = params.toString();
    return `/orgs/${orgId}/timetable/templates/${templateId}${qs ? `?${qs}` : ""}`;
  };

  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TIMETABLE, {
    redirectTo: `/orgs/${orgId}/timetable`,
  });

  const [template, org, tasks, rawMemberships] = await Promise.all([
    getTimetableTemplate(orgId, templateId),
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { openTimeMin: true, closeTimeMin: true },
    }),
    getTasks(orgId),
    prisma.membership.findMany({
      where: { orgId },
      select: {
        id: true,
        botName: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  if (!template) notFound();

  // Build taskId → role color map (first eligible role, same as timetable page)
  const taskRoleColorMap = new Map(
    tasks.map((t) => [t.id, t.eligibility[0]?.role?.color ?? null]),
  );

  const instances: ClientTemplateInstance[] = template.entries.map((inst) => ({
    id: inst.id,
    dayIndex: inst.dayIndex,
    startTimeMin: inst.startTimeMin!,
    taskColor: taskRoleColorMap.get(inst.task.id) ?? null,
    task: {
      id: inst.task.id,
      name: inst.task.name,
      durationMin: inst.task.durationMin,
    },
    assignees: inst.assignees.map((a) => ({
      id: a.id,
      membership: {
        id: a.membership.id,
        botName: a.membership.botName ?? null,
        user: a.membership.user
          ? { id: a.membership.user.id, name: a.membership.user.name }
          : null,
      },
    })),
  }));

  const availableTasks: ClientTask[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    durationMin: t.durationMin,
    color: t.color,
    roleColor: t.eligibility[0]?.role?.color ?? null,
    roleName: t.eligibility[0]?.role?.name ?? null,
  }));
  const memberships: ClientMembership[] = rawMemberships;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - 148px)", minHeight: "600px" }}
    >
      <RegisterPageSidebarSubContent
        content={
          <TemplateEditorSidebarContent
            orgId={orgId}
            templateId={templateId}
            templateDays={template.cycleLengthDays}
            mode={mode}
            span={span}
            calendarHref={editorHref({ mode: "calendar" })}
            simpleHref={editorHref({ mode: "simple" })}
            dayHref={editorHref({ span: "day" })}
            weekHref={editorHref({ span: "week" })}
            availableTasks={availableTasks}
          />
        }
      />

      <TemplateEditorClient
        title={
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{template.name}</span>
            <span className="text-xs text-muted-foreground">
              · {template.cycleLengthDays} day cycle
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
              Draft
            </span>
          </div>
        }
        orgId={orgId}
        templateId={templateId}
        templateDays={template.cycleLengthDays}
        instances={instances}
        availableTasks={availableTasks}
        memberships={memberships}
        openTimeMin={org?.openTimeMin ?? 360}
        closeTimeMin={org?.closeTimeMin ?? 1320}
        mode={mode}
        span={span}
        fillHeight
      />
    </div>
  );
}
