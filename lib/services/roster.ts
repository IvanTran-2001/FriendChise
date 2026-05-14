/**
 * @file roster.ts
 * Service functions for reading and mutating roster entries and day configs.
 */
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RosterMember = {
  membershipId: string;
  name: string;
  shiftStartMin: number | null;
  shiftEndMin: number | null;
};

export type RosterCell = {
  dayIndex: number;
  weekStart: Date;
  members: RosterMember[];
};

export type RosterDayConfigRow = {
  dayIndex: number;
  recommendedSize: number;
  openTimeMin: number | null;
  closeTimeMin: number | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the org's default open/close times.
 */
export async function getOrgSchedule(
  orgId: string,
): Promise<{ openTimeMin: number | null; closeTimeMin: number | null; timezone: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { openTimeMin: true, closeTimeMin: true, timezone: true },
  });
  return {
    openTimeMin: org?.openTimeMin ?? null,
    closeTimeMin: org?.closeTimeMin ?? null,
    timezone: org?.timezone ?? "UTC",
  };
}

/**
 * Returns true if the org has any roster entries or day configs (i.e. has used the Roster tool).
 */
export async function hasRosterActivity(orgId: string): Promise<boolean> {
  const [entries, configs] = await Promise.all([
    prisma.rosterEntry.count({ where: { orgId } }),
    prisma.rosterDayConfig.count({ where: { orgId } }),
  ]);
  return entries > 0 || configs > 0;
}

/**
 * Returns all RosterEntry rows for the given org and list of weekStart dates,
 * grouped by dayIndex within each weekStart.
 */
export async function getRosterEntries(orgId: string, weekStarts: Date[]) {
  if (weekStarts.length === 0) return [];
  return prisma.rosterEntry.findMany({
    where: { orgId, weekStart: { in: weekStarts } },
    include: {
      membership: {
        select: {
          id: true,
          botName: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: [{ weekStart: "asc" }, { dayIndex: "asc" }],
  });
}

/**
 * Returns all RosterDayConfig rows for the org, keyed by dayIndex.
 */
export async function getRosterDayConfigs(orgId: string) {
  return prisma.rosterDayConfig.findMany({
    where: { orgId },
    orderBy: { dayIndex: "asc" },
  });
}

/**
 * Returns all active memberships for the org (for the member picker).
 */
export async function getOrgMembersForRoster(orgId: string) {
  return prisma.membership.findMany({
    where: { orgId, status: "ACTIVE" },
    select: {
      id: true,
      botName: true,
      user: { select: { name: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export type RosterCellMember = {
  membershipId: string;
  shiftStartMin: number | null;
  shiftEndMin: number | null;
};

/**
 * Replaces all members assigned to a specific (weekStart, dayIndex) cell.
 * Runs in a transaction: deletes existing, then inserts new.
 */
export async function setRosterCellMembers(
  orgId: string,
  weekStart: Date,
  dayIndex: number,
  members: RosterCellMember[],
): Promise<ServiceResult<null>> {
  if (dayIndex < 0 || dayIndex > 6)
    return { ok: false, error: "Invalid day index", code: "INVALID" };

  const membershipIds = members.map((m) => m.membershipId);

  // Verify all memberships belong to this org
  if (membershipIds.length > 0) {
    const count = await prisma.membership.count({
      where: { id: { in: membershipIds }, orgId },
    });
    if (count !== membershipIds.length)
      return { ok: false, error: "Invalid membership", code: "NOT_FOUND" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterEntry.deleteMany({
      where: { orgId, weekStart, dayIndex },
    });
    if (members.length > 0) {
      await tx.rosterEntry.createMany({
        data: members.map((m) => ({
          orgId,
          membershipId: m.membershipId,
          weekStart,
          dayIndex,
          shiftStartMin: m.shiftStartMin,
          shiftEndMin: m.shiftEndMin,
        })),
      });
    }
  });

  return { ok: true, data: null };
}

/**
 * Upserts the RosterDayConfig for a given dayIndex.
 */
export async function upsertRosterDayConfig(
  orgId: string,
  dayIndex: number,
  data: {
    recommendedSize?: number;
    openTimeMin?: number | null;
    closeTimeMin?: number | null;
  },
): Promise<ServiceResult<null>> {
  if (dayIndex < 0 || dayIndex > 6)
    return { ok: false, error: "Invalid day index", code: "INVALID" };
  if (
    data.recommendedSize !== undefined &&
    (data.recommendedSize < 0 || data.recommendedSize > 100)
  )
    return { ok: false, error: "Invalid recommended size", code: "INVALID" };

  await prisma.rosterDayConfig.upsert({
    where: { orgId_dayIndex: { orgId, dayIndex } },
    create: { orgId, dayIndex, ...data },
    update: data,
  });

  return { ok: true, data: null };
}

// ─── Roster Templates ─────────────────────────────────────────────────────────

export async function getRosterTemplates(orgId: string) {
  return prisma.rosterTemplate.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      cycleWeeks: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  });
}

export async function getRosterTemplate(orgId: string, templateId: string) {
  return prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
    include: {
      entries: {
        include: {
          membership: {
            select: {
              id: true,
              botName: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: [{ weekIndex: "asc" }, { dayIndex: "asc" }],
      },
    },
  });
}

export type RosterTemplateCellMember = {
  membershipId: string;
  shiftStartMin: number | null;
  shiftEndMin: number | null;
};

export async function setRosterTemplateCellMembers(
  orgId: string,
  templateId: string,
  weekIndex: number,
  dayIndex: number,
  members: RosterTemplateCellMember[],
): Promise<ServiceResult<null>> {
  if (dayIndex < 0 || dayIndex > 6)
    return { ok: false, error: "Invalid day index", code: "INVALID" };

  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
    select: { id: true, cycleWeeks: true },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };
  if (weekIndex < 0 || weekIndex >= template.cycleWeeks)
    return { ok: false, error: "Invalid week index", code: "INVALID" };

  const membershipIds = members.map((m) => m.membershipId);
  if (membershipIds.length > 0) {
    const count = await prisma.membership.count({
      where: { id: { in: membershipIds }, orgId },
    });
    if (count !== membershipIds.length)
      return { ok: false, error: "Invalid membership", code: "NOT_FOUND" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterTemplateEntry.deleteMany({
      where: { templateId, weekIndex, dayIndex },
    });
    if (members.length > 0) {
      await tx.rosterTemplateEntry.createMany({
        data: members.map((m) => ({
          templateId,
          membershipId: m.membershipId,
          weekIndex,
          dayIndex,
          shiftStartMin: m.shiftStartMin,
          shiftEndMin: m.shiftEndMin,
        })),
      });
    }
  });

  return { ok: true, data: null };
}

export async function createRosterTemplate(
  orgId: string,
  name: string,
  cycleWeeks: number = 1,
): Promise<ServiceResult<{ id: string }>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required", code: "INVALID" };
  if (cycleWeeks < 1 || cycleWeeks > 12)
    return { ok: false, error: "Cycle weeks must be 1–12", code: "INVALID" };

  const existing = await prisma.rosterTemplate.findFirst({
    where: { orgId, name: trimmed },
  });
  if (existing)
    return { ok: false, error: "A template with that name already exists", code: "CONFLICT" };

  const template = await prisma.rosterTemplate.create({
    data: { orgId, name: trimmed, cycleWeeks },
    select: { id: true },
  });
  return { ok: true, data: template };
}

export async function deleteRosterTemplate(
  orgId: string,
  templateId: string,
): Promise<ServiceResult<null>> {
  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  await prisma.rosterTemplate.delete({ where: { id: templateId } });
  return { ok: true, data: null };
}

export async function renameRosterTemplate(
  orgId: string,
  templateId: string,
  name: string,
): Promise<ServiceResult<null>> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required", code: "INVALID" };

  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  const conflict = await prisma.rosterTemplate.findFirst({
    where: { orgId, name: trimmed, id: { not: templateId } },
  });
  if (conflict)
    return { ok: false, error: "A template with that name already exists", code: "CONFLICT" };

  await prisma.rosterTemplate.update({
    where: { id: templateId },
    data: { name: trimmed },
  });
  return { ok: true, data: null };
}

export async function updateRosterTemplateCycleWeeks(
  orgId: string,
  templateId: string,
  cycleWeeks: number,
): Promise<ServiceResult<null>> {
  if (cycleWeeks < 1 || cycleWeeks > 12)
    return { ok: false, error: "Cycle weeks must be between 1 and 12", code: "INVALID" };

  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  await prisma.rosterTemplate.update({
    where: { id: templateId },
    data: { cycleWeeks },
  });
  return { ok: true, data: null };
}

export async function clearRosterTemplateWeek(
  orgId: string,
  templateId: string,
  weekIndex: number,
): Promise<ServiceResult<null>> {
  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  await prisma.rosterTemplateEntry.deleteMany({
    where: { templateId, weekIndex },
  });
  return { ok: true, data: null };
}

export async function applyRosterTemplate(
  orgId: string,
  templateId: string,
  startMonday: Date,
  cycleRepeats: number,
  force: boolean,
): Promise<ServiceResult<null>> {
  if (cycleRepeats < 1 || cycleRepeats > 52)
    return { ok: false, error: "cycleRepeats must be 1–52", code: "INVALID" };

  const template = await prisma.rosterTemplate.findFirst({
    where: { id: templateId, orgId },
    include: { entries: true },
  });
  if (!template)
    return { ok: false, error: "Template not found", code: "NOT_FOUND" };

  // All week starts affected: cycleWeeks * cycleRepeats consecutive weeks
  const totalWeeks = template.cycleWeeks * cycleRepeats;
  const weekStarts: Date[] = Array.from({ length: totalWeeks }, (_, i) => {
    const d = new Date(startMonday);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d;
  });

  if (!force) {
    const conflictCount = await prisma.rosterEntry.count({
      where: { orgId, weekStart: { in: weekStarts } },
    });
    if (conflictCount > 0)
      return { ok: false, error: "Target weeks already have entries", code: "CONFLICT" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.rosterEntry.deleteMany({ where: { orgId, weekStart: { in: weekStarts } } });

    const insertData = [];
    for (let r = 0; r < cycleRepeats; r++) {
      for (const entry of template.entries) {
        const weekStart = new Date(startMonday);
        weekStart.setUTCDate(
          weekStart.getUTCDate() + (r * template.cycleWeeks + entry.weekIndex) * 7,
        );
        insertData.push({
          orgId,
          membershipId: entry.membershipId,
          weekStart,
          dayIndex: entry.dayIndex,
          shiftStartMin: entry.shiftStartMin,
          shiftEndMin: entry.shiftEndMin,
        });
      }
    }
    if (insertData.length > 0)
      await tx.rosterEntry.createMany({ data: insertData, skipDuplicates: true });
  });

  return { ok: true, data: null };
}
