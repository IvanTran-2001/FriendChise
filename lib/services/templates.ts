/**
 * @file templates.ts
 * Service functions for reading and mutating timetable templates and their entries.
 */
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ServiceResult } from "./types";
import {
  localMidnightUTC,
  addCalendarDays,
  localToUTC,
  utcToLocal,
} from "@/lib/date-utils";

/**
 * Returns all templates for the given org, ordered newest-first.
 * Includes the total number of entries on each template via `_count`.
 */
export async function getTimetableTemplates(orgId: string) {
  return prisma.template.findMany({
    where: { orgId },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns a single template with its fully-expanded entries (task details,
 * assignee memberships and user names), ordered by day then start time.
 * Returns `null` if no matching template exists in the org.
 */
export async function getTimetableTemplate(orgId: string, templateId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, orgId },
    include: {
      entries: {
        include: {
          task: { select: { id: true, name: true, durationMin: true } },
          assignees: {
            where: { membership: { orgId } },
            include: {
              membership: {
                select: {
                  id: true,
                  botName: true,
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ dayIndex: "asc" }, { startTimeMin: "asc" }],
      },
    },
  });
}

/**
 * Creates a new template for the org.
 */
export async function createTemplate(
  orgId: string,
  name: string,
  cycleLengthDays: number,
): Promise<ServiceResult<{ id: string }>> {
  const template = await prisma.template.create({
    data: { orgId, name, cycleLengthDays },
    select: { id: true },
  });
  Sentry.logger.info("Template created", { orgId, templateId: template.id, name });
  return { ok: true, data: template };
}

/**
 * Adds a task entry to a template at the given day index and start time.
 * `endTimeMin` defaults to `startTimeMin + task.durationMin`, capped at 24:00 (1440).
 */
export async function addTemplateInstance(
  orgId: string,
  templateId: string,
  taskId: string,
  dayIndex: number,
  startTimeMin: number,
): Promise<ServiceResult<null>> {
  const [task, template] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, orgId },
      select: { id: true, durationMin: true },
    }),
    prisma.template.findFirst({
      where: { id: templateId, orgId },
      select: { id: true, cycleLengthDays: true },
    }),
  ]);
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };
  if (dayIndex < 0 || dayIndex >= template.cycleLengthDays) {
    return {
      ok: false,
      error: `Day must be between 0 and ${template.cycleLengthDays - 1}`,
      code: "INVALID",
    };
  }
  if (startTimeMin < 0 || startTimeMin > 1439) {
    return { ok: false, error: "Invalid time", code: "INVALID" };
  }

  const endTimeMin = Math.min(startTimeMin + task.durationMin, 1440);
  await prisma.templateEntry.create({
    data: { taskId, templateId, dayIndex, startTimeMin, endTimeMin },
  });
  Sentry.logger.info("Template instance added", { orgId, templateId, taskId });
  return { ok: true, data: null };
}

/**
 * Removes a single entry from a template.
 */
export async function removeTemplateInstance(
  orgId: string,
  instanceId: string,
): Promise<ServiceResult<null>> {
  const entry = await prisma.templateEntry.findFirst({
    where: { id: instanceId, template: { orgId } },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: "Not found", code: "NOT_FOUND" };

  await prisma.templateEntry.delete({ where: { id: instanceId } });
  Sentry.logger.info("Template instance removed", { orgId, instanceId });
  return { ok: true, data: null };
}

/**
 * Updates the `dayIndex` and/or `startTimeMin` of a template entry.
 */
export async function updateTemplateInstance(
  orgId: string,
  instanceId: string,
  update: { dayIndex?: number; startTimeMin?: number },
): Promise<ServiceResult<null>> {
  const entry = await prisma.templateEntry.findFirst({
    where: { id: instanceId, template: { orgId } },
    select: {
      id: true,
      templateId: true,
      durationMin: true,
      task: { select: { durationMin: true } },
    },
  });
  if (!entry) return { ok: false, error: "Not found", code: "NOT_FOUND" };

  if (update.dayIndex !== undefined) {
    const template = await prisma.template.findFirst({
      where: { id: entry.templateId, orgId },
      select: { cycleLengthDays: true },
    });
    if (!template)
      return { ok: false, error: "Template not found", code: "NOT_FOUND" };
    if (
      !Number.isInteger(update.dayIndex) ||
      update.dayIndex < 0 ||
      update.dayIndex >= template.cycleLengthDays
    ) {
      return {
        ok: false,
        error: `Day must be between 0 and ${template.cycleLengthDays - 1}`,
        code: "INVALID",
      };
    }
  }

  if (
    update.startTimeMin !== undefined &&
    (update.startTimeMin < 0 || update.startTimeMin > 1439)
  ) {
    return { ok: false, error: "Invalid time", code: "INVALID" };
  }

  await prisma.templateEntry.update({
    where: { id: instanceId },
    data: {
      ...(update.dayIndex !== undefined && { dayIndex: update.dayIndex }),
      ...(update.startTimeMin !== undefined && {
        startTimeMin: update.startTimeMin,
        endTimeMin: Math.min(
          update.startTimeMin + (entry.durationMin ?? entry.task.durationMin),
          1440,
        ),
      }),
    },
  });  Sentry.logger.info("Template instance updated", { orgId, instanceId });  return { ok: true, data: null };
}

/**
 * Resizes a template's cycle length.
 * Blocks if any existing entries have a `dayIndex` that falls outside the new length.
 */
export async function updateTemplateDays(
  orgId: string,
  templateId: string,
  cycleLengthDays: number,
): Promise<ServiceResult<null>> {
  if (
    !Number.isInteger(cycleLengthDays) ||
    cycleLengthDays < 1 ||
    cycleLengthDays > 365
  ) {
    return { ok: false, error: "Invalid cycle length", code: "INVALID" };
  }

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
      code: "INVALID",
    };
  }

  const updated = await prisma.template.updateMany({
    where: { id: templateId, orgId },
    data: { cycleLengthDays },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };
  }
  Sentry.logger.info("Template cycle length updated", { orgId, templateId, cycleLengthDays });
  return { ok: true, data: null };
}

/**
 * Assigns a member to a template entry (upsert — safe to call if already assigned).
 */
export async function addTemplateInstanceAssignee(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
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
  if (!entry)
    return { ok: false, error: "Template entry not found", code: "NOT_FOUND" };
  if (!membership)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

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
  Sentry.logger.info("Template instance assignee added", { orgId, instanceId, membershipId });
  return { ok: true, data: null };
}

/**
 * Removes a member from a template entry's assignee list.
 */
export async function removeTemplateInstanceAssignee(
  orgId: string,
  instanceId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
  const assignee = await prisma.templateEntryAssignee.findFirst({
    where: {
      templateEntryId: instanceId,
      membershipId,
      templateEntry: { template: { orgId } },
    },
    select: { id: true },
  });
  if (!assignee) return { ok: false, error: "Not found", code: "NOT_FOUND" };

  await prisma.templateEntryAssignee.delete({ where: { id: assignee.id } });
  Sentry.logger.info("Template instance assignee removed", { orgId, instanceId, membershipId });
  return { ok: true, data: null };
}

/**
 * Counts TimetableEntries in [startDateStr, startDateStr + totalDays) for the given org.
 * Used by the apply-template dialog to warn when existing entries will be replaced.
 */
export async function countTimetableEntriesInRange(
  orgId: string,
  startDateStr: string,
  totalDays: number,
): Promise<ServiceResult<{ count: number }>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };

  const orgTz = org.timezone ?? "UTC";
  const MS_DAY = 86_400_000;
  const startUtcMs = localMidnightUTC(startDateStr, orgTz);
  const endUtcMs = localMidnightUTC(
    addCalendarDays(startDateStr, totalDays),
    orgTz,
  );
  const queryFrom = new Date(Math.floor(startUtcMs / MS_DAY) * MS_DAY - MS_DAY);
  const queryTo = new Date(Math.floor(endUtcMs / MS_DAY) * MS_DAY + MS_DAY * 2);

  const rows = await prisma.timetableEntry.findMany({
    where: { orgId, date: { gte: queryFrom, lt: queryTo } },
    select: { date: true, startTimeMin: true },
  });

  const endDateStr = addCalendarDays(startDateStr, totalDays);
  const count = rows.filter((r) => {
    const { localDateStr } = utcToLocal(r.date, r.startTimeMin, orgTz);
    return localDateStr >= startDateStr && localDateStr < endDateStr;
  }).length;

  return { ok: true, data: { count } };
}

/**
 * Applies a template to the timetable.
 * Deletes ALL existing TimetableEntries in the date range, then creates new
 * ones by projecting the template entries across `cycleRepeats` repetitions
 * starting from `startDateStr` (YYYY-MM-DD) in the org's timezone.
 */
export async function applyTemplate(
  orgId: string,
  templateId: string,
  startDateStr: string,
  cycleRepeats: number,
): Promise<ServiceResult<{ created: number }>> {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return { ok: false, error: "Invalid start date", code: "INVALID" };
  }
  if (
    !Number.isInteger(cycleRepeats) ||
    cycleRepeats < 1 ||
    cycleRepeats > 52
  ) {
    return {
      ok: false,
      error: "Cycle repeat must be between 1 and 52",
      code: "INVALID",
    };
  }

  const [org, template] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    }),
    prisma.template.findFirst({
      where: { id: templateId, orgId },
      include: {
        entries: {
          include: {
            task: {
              select: {
                id: true,
                name: true,
                color: true,
                description: true,
                durationMin: true,
              },
            },
            assignees: { select: { membershipId: true } },
          },
        },
      },
    }),
  ]);

  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  const orgTz = org.timezone ?? "UTC";
  const totalDays = template.cycleLengthDays * cycleRepeats;
  const endDateStr = addCalendarDays(startDateStr, totalDays);
  const MS_DAY = 86_400_000;
  const startUtcMs = localMidnightUTC(startDateStr, orgTz);
  const endUtcMs = localMidnightUTC(endDateStr, orgTz);
  const queryFrom = new Date(Math.floor(startUtcMs / MS_DAY) * MS_DAY - MS_DAY);
  const queryTo = new Date(Math.floor(endUtcMs / MS_DAY) * MS_DAY + MS_DAY * 2);

  const toDelete = await prisma.timetableEntry.findMany({
    where: { orgId, date: { gte: queryFrom, lt: queryTo } },
    select: { id: true, date: true, startTimeMin: true },
  });

  const idsToDelete = toDelete
    .filter((e) => {
      const { localDateStr } = utcToLocal(e.date, e.startTimeMin, orgTz);
      return localDateStr >= startDateStr && localDateStr < endDateStr;
    })
    .map((e) => e.id);

  const createData: Array<{
    orgId: string;
    taskId: string;
    taskName: string;
    taskColor: string;
    taskDescription: string | null;
    durationMin: number;
    date: Date;
    startTimeMin: number;
    endTimeMin: number;
    assignees: string[];
  }> = [];
  for (let repeat = 0; repeat < cycleRepeats; repeat++) {
    for (const entry of template.entries) {
      const dayOffset = repeat * template.cycleLengthDays + entry.dayIndex;
      const dayDateStr = addCalendarDays(startDateStr, dayOffset);
      const durationMin = entry.durationMin ?? entry.task.durationMin;
      const { utcDate, utcStartTimeMin } = localToUTC(
        dayDateStr,
        entry.startTimeMin,
        orgTz,
      );
      createData.push({
        orgId,
        taskId: entry.task.id,
        taskName: entry.task.name,
        taskColor: entry.task.color,
        taskDescription: entry.task.description,
        durationMin,
        date: utcDate,
        startTimeMin: utcStartTimeMin,
        endTimeMin: Math.min(utcStartTimeMin + durationMin, 1440),
        assignees: entry.assignees.map((a) => a.membershipId),
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (idsToDelete.length > 0) {
      await tx.timetableEntry.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
    for (const { assignees, ...data } of createData) {
      await tx.timetableEntry.create({
        data: {
          ...data,
          assignees: {
            create: assignees.map((membershipId) => ({ membershipId })),
          },
        },
      });
    }
  });

  Sentry.logger.info("Template applied", { orgId, templateId, startDateStr, cycleRepeats, created: createData.length });
  return { ok: true, data: { created: createData.length } };
}

/**
 * Renames a template.
 */
export async function renameTemplate(
  orgId: string,
  templateId: string,
  name: string,
): Promise<ServiceResult<null>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required", code: "INVALID" };

  try {
    const updated = await prisma.template.updateMany({
      where: { id: templateId, orgId },
      data: { name: trimmed },
    });
    if (updated.count === 0)
      return { ok: false, error: "Template not found", code: "NOT_FOUND" };

    Sentry.logger.info("Template renamed", { orgId, templateId });
    return { ok: true, data: null };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "A template with that name already exists",
        code: "INVALID",
      };
    }
    throw error;
  }
}

/**
 * Duplicates a template and all its entries (assignees are also copied).
 * The copy is named "Copy of <original name>" (or "Copy of Copy of …" if needed).
 */
export async function duplicateTemplate(
  orgId: string,
  templateId: string,
): Promise<ServiceResult<{ id: string }>> {
  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId },
    include: {
      entries: {
        include: { assignees: { select: { membershipId: true } } },
      },
    },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  const baseName = `Copy of ${template.name}`;
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Generate candidate name
    const candidateName = attempt === 0 ? baseName : `${baseName} (${attempt + 1})`;

    try {
      const copy = await prisma.template.create({
        data: {
          orgId,
          name: candidateName,
          cycleLengthDays: template.cycleLengthDays,
          entries: {
            create: template.entries.map((e) => ({
              taskId: e.taskId,
              dayIndex: e.dayIndex,
              startTimeMin: e.startTimeMin,
              endTimeMin: e.endTimeMin,
              priority: e.priority,
              durationMin: e.durationMin,
              assignees: {
                create: e.assignees.map((a) => ({ membershipId: a.membershipId })),
              },
            })),
          },
        },
        select: { id: true },
      });

      Sentry.logger.info("Template duplicated", { orgId, sourceTemplateId: templateId, newTemplateId: copy.id });
      return { ok: true, data: { id: copy.id } };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Name collision, retry with next suffix
        if (attempt === maxRetries - 1) {
          return {
            ok: false,
            error: "A template with that name already exists",
            code: "INVALID",
          };
        }
        continue;
      }
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    ok: false,
    error: "A template with that name already exists",
    code: "INVALID",
  };
}

/**
 * Permanently deletes a template and all its entries (cascade).
 */
export async function deleteTemplate(
  orgId: string,
  templateId: string,
): Promise<ServiceResult<null>> {
  const deleted = await prisma.template.deleteMany({
    where: { id: templateId, orgId },
  });
  if (deleted.count === 0)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  Sentry.logger.info("Template deleted", { orgId, templateId });
  return { ok: true, data: null };
}