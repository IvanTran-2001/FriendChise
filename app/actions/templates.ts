"use server";

import { OrgPermission } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateTemplateFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

export async function createTemplateAction(
  orgId: string,
  _prev: CreateTemplateFormState,
  formData: FormData,
): Promise<CreateTemplateFormState> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_CREATE);
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const title = String(formData.get("title") ?? "").trim();
  const templateDaysRaw = Number(formData.get("templateDays") ?? 7);

  if (!title) return { ok: false, errors: { title: ["Title is required"] } };
  if (
    !Number.isInteger(templateDaysRaw) ||
    templateDaysRaw < 1 ||
    templateDaysRaw > 365
  ) {
    return {
      ok: false,
      errors: { templateDays: ["Must be between 1 and 365"] },
    };
  }

  const template = await prisma.timetableTemplate.create({
    data: { orgId, title, templateDays: templateDaysRaw },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  redirect(`/orgs/${orgId}/timetable/templates/${template.id}`);
}

export async function addTemplateInstanceAction(
  orgId: string,
  templateId: string,
  taskId: string,
  dayOffset: number,
  startTimeMin: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_CREATE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const [task, template] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, orgId },
      select: { id: true },
    }),
    prisma.timetableTemplate.findFirst({
      where: { id: templateId, orgId },
      select: { id: true, templateDays: true },
    }),
  ]);

  if (!task) return { ok: false, error: "Task not found" };
  if (!template) return { ok: false, error: "Template not found" };
  if (dayOffset < 1 || dayOffset > template.templateDays) {
    return {
      ok: false,
      error: `Day must be between 1 and ${template.templateDays}`,
    };
  }
  if (startTimeMin < 0 || startTimeMin > 1439) {
    return { ok: false, error: "Invalid time" };
  }

  await prisma.taskInstance.create({
    data: { orgId, taskId, templateId, dayOffset, startTimeMin },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

export async function removeTemplateInstanceAction(
  orgId: string,
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_DELETE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const instance = await prisma.taskInstance.findFirst({
    where: { id: instanceId, orgId, templateId: { not: null } },
    select: { id: true },
  });
  if (!instance) return { ok: false, error: "Not found" };

  await prisma.taskInstance.delete({ where: { id: instanceId } });
  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

export async function updateTemplateInstanceAction(
  orgId: string,
  instanceId: string,
  update: { dayOffset?: number; startTimeMin?: number },
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_UPDATE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const instance = await prisma.taskInstance.findFirst({
    where: { id: instanceId, orgId, templateId: { not: null } },
    select: { id: true, templateId: true },
  });
  if (!instance) return { ok: false, error: "Not found" };

  if (update.dayOffset !== undefined) {
    const template = await prisma.timetableTemplate.findFirst({
      where: { id: instance.templateId!, orgId },
      select: { templateDays: true },
    });
    if (!template) return { ok: false, error: "Template not found" };
    if (
      !Number.isInteger(update.dayOffset) ||
      update.dayOffset < 1 ||
      update.dayOffset > template.templateDays
    ) {
      return {
        ok: false,
        error: `Day must be between 1 and ${template.templateDays}`,
      };
    }
  }

  if (
    update.startTimeMin !== undefined &&
    (update.startTimeMin < 0 || update.startTimeMin > 1439)
  ) {
    return { ok: false, error: "Invalid time" };
  }

  await prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      ...(update.dayOffset !== undefined && { dayOffset: update.dayOffset }),
      ...(update.startTimeMin !== undefined && {
        startTimeMin: update.startTimeMin,
      }),
    },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

export async function updateTemplateDaysAction(
  orgId: string,
  templateId: string,
  templateDays: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_UPDATE);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (
    !Number.isInteger(templateDays) ||
    templateDays < 1 ||
    templateDays > 365
  ) {
    return { ok: false, error: "Invalid cycle length" };
  }

  // Block shrink if any instances have a dayOffset that would be out of range
  const stranded = await prisma.taskInstance.count({
    where: {
      templateId,
      orgId,
      dayOffset: { gt: templateDays },
    },
  });
  if (stranded > 0) {
    return {
      ok: false,
      error: `Cannot shrink cycle: ${stranded} task${stranded === 1 ? "" : "s"} are on days beyond ${templateDays}. Move or remove them first.`,
    };
  }

  await prisma.timetableTemplate.updateMany({
    where: { id: templateId, orgId },
    data: { templateDays },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

export async function addInstanceAssigneeAction(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_ASSIGN);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const [instance, membership] = await Promise.all([
    prisma.taskInstance.findFirst({
      where: { id: instanceId, orgId },
      select: { id: true },
    }),
    prisma.membership.findFirst({
      where: { id: membershipId, orgId },
      select: { id: true },
    }),
  ]);
  if (!instance) return { ok: false, error: "Instance not found" };
  if (!membership) return { ok: false, error: "Membership not found" };

  await prisma.taskInstanceAssignee.upsert({
    where: {
      taskInstanceId_membershipId: { taskInstanceId: instanceId, membershipId },
    },
    create: { taskInstanceId: instanceId, membershipId },
    update: {},
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

export async function removeInstanceAssigneeAction(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermission(orgId, OrgPermission.TASK_ASSIGN);
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const assignee = await prisma.taskInstanceAssignee.findFirst({
    where: {
      taskInstanceId: instanceId,
      membershipId,
      taskInstance: { orgId },
    },
    select: { id: true },
  });
  if (!assignee) return { ok: false, error: "Not found" };

  await prisma.taskInstanceAssignee.delete({ where: { id: assignee.id } });
  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}
