"use server";

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
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
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const name = String(formData.get("title") ?? "").trim();
  const cycleLengthDays = Number(formData.get("templateDays") ?? 7);

  if (!name) return { ok: false, errors: { title: ["Title is required"] } };
  if (
    !Number.isInteger(cycleLengthDays) ||
    cycleLengthDays < 1 ||
    cycleLengthDays > 365
  ) {
    return {
      ok: false,
      errors: { templateDays: ["Must be between 1 and 365"] },
    };
  }

  const template = await prisma.template.create({
    data: { orgId, name, cycleLengthDays },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  redirect(`/orgs/${orgId}/timetable/templates/${template.id}`);
}

export async function addTemplateInstanceAction(
  orgId: string,
  templateId: string,
  taskId: string,
  dayIndex: number,
  startTimeMin: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const [task, template] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, orgId },
      select: { id: true },
    }),
    prisma.template.findFirst({
      where: { id: templateId, orgId },
      select: { id: true, cycleLengthDays: true },
    }),
  ]);

  if (!task) return { ok: false, error: "Task not found" };
  if (!template) return { ok: false, error: "Template not found" };
  if (dayIndex < 0 || dayIndex >= template.cycleLengthDays) {
    return {
      ok: false,
      error: `Day must be between 0 and ${template.cycleLengthDays - 1}`,
    };
  }
  if (startTimeMin < 0 || startTimeMin > 1439) {
    return { ok: false, error: "Invalid time" };
  }

  const endTimeMin = Math.min(startTimeMin + 60, 1439);
  await prisma.templateEntry.create({
    data: { taskId, templateId, dayIndex, startTimeMin, endTimeMin },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

export async function removeTemplateInstanceAction(
  orgId: string,
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const entry = await prisma.templateEntry.findFirst({
    where: { id: instanceId, template: { orgId } },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: "Not found" };

  await prisma.templateEntry.delete({ where: { id: instanceId } });
  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}

export async function updateTemplateInstanceAction(
  orgId: string,
  instanceId: string,
  update: { dayIndex?: number; startTimeMin?: number },
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const entry = await prisma.templateEntry.findFirst({
    where: { id: instanceId, template: { orgId } },
    select: { id: true, templateId: true },
  });
  if (!entry) return { ok: false, error: "Not found" };

  if (update.dayIndex !== undefined) {
    const template = await prisma.template.findFirst({
      where: { id: entry.templateId, orgId },
      select: { cycleLengthDays: true },
    });
    if (!template) return { ok: false, error: "Template not found" };
    if (
      !Number.isInteger(update.dayIndex) ||
      update.dayIndex < 0 ||
      update.dayIndex >= template.cycleLengthDays
    ) {
      return {
        ok: false,
        error: `Day must be between 0 and ${template.cycleLengthDays - 1}`,
      };
    }
  }

  if (
    update.startTimeMin !== undefined &&
    (update.startTimeMin < 0 || update.startTimeMin > 1439)
  ) {
    return { ok: false, error: "Invalid time" };
  }

  await prisma.templateEntry.update({
    where: { id: instanceId },
    data: {
      ...(update.dayIndex !== undefined && { dayIndex: update.dayIndex }),
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
  cycleLengthDays: number,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TASKS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  if (
    !Number.isInteger(cycleLengthDays) ||
    cycleLengthDays < 1 ||
    cycleLengthDays > 365
  ) {
    return { ok: false, error: "Invalid cycle length" };
  }

  // Block shrink if any entries have a dayIndex that would be out of range
  const stranded = await prisma.templateEntry.count({
    where: {
      templateId,
      template: { orgId },
      dayIndex: { gte: cycleLengthDays },
    },
  });
  if (stranded > 0) {
    return {
      ok: false,
      error: `Cannot shrink cycle: ${stranded} task${stranded === 1 ? "" : "s"} are on days beyond ${cycleLengthDays}. Move or remove them first.`,
    };
  }

  await prisma.template.updateMany({
    where: { id: templateId, orgId },
    data: { cycleLengthDays },
  });

  revalidatePath(`/orgs/${orgId}/timetable/templates/${templateId}`);
  return { ok: true };
}

export async function addInstanceAssigneeAction(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const [entry, membership] = await Promise.all([
    prisma.templateEntry.findFirst({
      where: { id: instanceId, template: { orgId } },
      select: { id: true },
    }),
    prisma.membership.findFirst({
      where: { id: membershipId, orgId },
      select: { id: true },
    }),
  ]);
  if (!entry) return { ok: false, error: "Template entry not found" };
  if (!membership) return { ok: false, error: "Membership not found" };

  await prisma.templateEntryAssignee.upsert({
    where: {
      templateEntryId_membershipId: {
        templateEntryId: instanceId,
        membershipId,
      },
    },
    create: { templateEntryId: instanceId, membershipId },
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
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_TIMETABLE,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const assignee = await prisma.templateEntryAssignee.findFirst({
    where: {
      templateEntryId: instanceId,
      membershipId,
      templateEntry: { template: { orgId } },
    },
    select: { id: true },
  });
  if (!assignee) return { ok: false, error: "Not found" };

  await prisma.templateEntryAssignee.delete({ where: { id: assignee.id } });
  revalidatePath(`/orgs/${orgId}/timetable/templates`);
  return { ok: true };
}
