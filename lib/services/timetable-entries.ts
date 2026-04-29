/**
 * @file timetable-entries.ts
 * Service functions for `TimetableEntry` (live scheduled task instances).
 *
 * UTC storage model:
 * - `date` is stored as the UTC midnight of the UTC calendar day that
 *   contains the event's absolute UTC timestamp.
 * - `startTimeMin` / `endTimeMin` are UTC minutes from that UTC midnight
 *   (0–1440), NOT wall-clock local minutes. 1440 = midnight end-of-day.
 * - All conversions between local and UTC use `localToUTC` / `utcToLocal`
 *   from `lib/date-utils`; never apply `getHours()` / `getMinutes()` directly.
 * - Template entries remain wall-clock (timezone-agnostic) and are NOT
 *   subject to UTC conversion — only live `TimetableEntry` rows use UTC.
 * - `getTimetableEntries` is the primary read path for the calendar view.
 */
import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { Prisma, EntryStatus } from "@prisma/client";
import { recordAudit } from "@/lib/services/audit-log";
import type { ServiceResult } from "./types";
import type { CreateTimetableEntryInput } from "@/lib/validators/timetable-entry";
import {
  localMidnightUTC,
  addCalendarDays,
  localToUTC,
  utcToLocal,
} from "@/lib/date-utils";

/** Options for filtering timetable entries returned by `listTimetableEntries`. */
export type ListTimetableEntriesOptions = {
  status?: EntryStatus;
  completed?: boolean;
};

/**
 * Creates a new timetable entry for the given org and task.
 * Validates that the task belongs to the org before inserting and
 * auto-populates snapshot fields (taskName, durationMin, etc.) from the task.
 * @param actorId - Optional caller ID forwarded from the action layer for audit log.
 */
export async function createTimetableEntryFromInput(
  orgId: string,
  data: CreateTimetableEntryInput,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<
  ServiceResult<Prisma.TimetableEntryGetPayload<Record<string, never>>>
> {
  const task = await prisma.task.findFirst({
    where: { id: data.taskId, orgId },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      durationMin: true,
    },
  });
  if (!task) {
    return {
      ok: false,
      error: "Invalid taskId: not found or does not belong to this org",
      code: "INVALID",
    };
  }

  const endTimeMin = Math.min(
    data.endTimeMin ?? data.startTimeMin + task.durationMin,
    1440,
  );

  try {
    const entry = await prisma.timetableEntry.create({
      data: {
        orgId,
        taskId: task.id,
        taskName: task.name,
        taskColor: task.color,
        taskDescription: task.description,
        durationMin: task.durationMin,
        date: new Date(data.date),
        startTimeMin: data.startTimeMin,
        endTimeMin,
      },
    });
    log.info("Timetable entry created", {
      orgId,
      entryId: entry.id,
      taskId: data.taskId,
    });
    recordAudit({
      orgId,
      actorId: actorId ?? null,
      actorEmail: actorEmail ?? null,
      action: "entry.create",
      targetType: "TimetableEntry",
      targetId: entry.id,
      after: {
        taskId: task.id,
        taskName: task.name,
        date: data.date,
        startTimeMin: data.startTimeMin,
        endTimeMin,
      },
    });
    return { ok: true, data: entry };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return {
          ok: false,
          error: "Invalid taskId: not found or does not belong to this org",
          code: "INVALID",
        };
      }
    }
    throw e;
  }
}

/**
 * Lists timetable entries for an org with optional status filtering.
 * `status` and `completed` are mutually exclusive:
 *   - `status`: filter to an exact EntryStatus value
 *   - `completed: true`:  only DONE or SKIPPED
 *   - `completed: false`: exclude DONE and SKIPPED
 */
export async function listTimetableEntries(
  orgId: string,
  options: ListTimetableEntriesOptions = {},
) {
  const where: Prisma.TimetableEntryWhereInput = { orgId };

  if (options.status != null) {
    where.status = options.status;
  } else if (options.completed === false) {
    where.status = {
      notIn: [EntryStatus.DONE, EntryStatus.SKIPPED],
    };
  } else if (options.completed === true) {
    where.status = {
      in: [EntryStatus.DONE, EntryStatus.SKIPPED],
    };
  }

  return prisma.timetableEntry.findMany({
    where,
    orderBy: { date: "desc" },
  });
}

/**
 * Fetches a single timetable entry by id, scoped to `orgId`.
 * Returns NOT_FOUND if the entry does not exist in this org.
 */
export async function getTimetableEntry(
  orgId: string,
  taskInstanceId: string,
): Promise<
  ServiceResult<Prisma.TimetableEntryGetPayload<Record<string, never>>>
> {
  const item = await prisma.timetableEntry.findFirst({
    where: { orgId, id: taskInstanceId },
  });
  if (!item)
    return {
      ok: false,
      error: "Timetable entry not found in this org",
      code: "NOT_FOUND",
    };
  return { ok: true, data: item };
}

/**
 * Updates the status of a timetable entry inside a transaction.
 * Uses `updateMany` (scoped by orgId) to detect missing records without an
 * extra query, then re-fetches the updated row to return to the caller.
 */
export async function updateTimetableEntryStatus(
  orgId: string,
  taskInstanceId: string,
  status: EntryStatus,
): Promise<
  ServiceResult<Prisma.TimetableEntryGetPayload<Record<string, never>>>
> {
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.timetableEntry.updateMany({
        where: { id: taskInstanceId, orgId },
        data: { status },
      });

      if (updated.count === 0) {
        throw Object.assign(
          new Error("Timetable entry not found in this org"),
          {
            code: "NOT_FOUND",
          },
        );
      }

      const item = await tx.timetableEntry.findUnique({
        where: { id: taskInstanceId },
      });
      if (!item) {
        throw Object.assign(
          new Error("Timetable entry not found in this org"),
          {
            code: "NOT_FOUND",
          },
        );
      }

      return item;
    });

    log.info("Timetable entry status updated", {
      orgId,
      entryId: taskInstanceId,
      status,
    });
    return { ok: true, data: entry };
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "NOT_FOUND") {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}

/** Full entry shape used by the timetable calendar view. */
export type TimetableInstance = Prisma.TimetableEntryGetPayload<{
  include: {
    task: true;
    assignees: {
      include: {
        membership: {
          include: { user: { select: { id: true; name: true } } };
        };
      };
    };
  };
}>;

/**
 * Fetches timetable entries for a local calendar week.
 *
 * Because entries are stored in UTC, a local day's entry may have a `date`
 * field on a different UTC calendar day (e.g. Sydney +11: 06:00 local =
 * 19:00 the previous UTC day). The query therefore widens the UTC range by
 * one day on each side and then filters in JS using the raw UTC timestamp.
 *
 * @param orgId     - Organisation to query.
 * @param orgTz     - IANA timezone string for the org (e.g. "Australia/Sydney").
 * @param weekStart - Local YYYY-MM-DD of the Monday at the start of the week.
 */
export async function getTimetableEntries(
  orgId: string,
  orgTz: string,
  weekStart: string,
): Promise<TimetableInstance[]> {
  const MS_DAY = 86_400_000;
  const weekStartUtcMs = localMidnightUTC(weekStart, orgTz);
  const weekEndUtcMs = localMidnightUTC(addCalendarDays(weekStart, 7), orgTz);

  // Widen by 1 UTC day on each side to capture timezone-boundary entries
  const queryFrom = new Date(
    Math.floor(weekStartUtcMs / MS_DAY) * MS_DAY - MS_DAY,
  );
  const queryTo = new Date(
    Math.floor(weekEndUtcMs / MS_DAY) * MS_DAY + MS_DAY * 2,
  );

  const rows = await prisma.timetableEntry.findMany({
    where: { orgId, date: { gte: queryFrom, lt: queryTo } },
    include: {
      task: true,
      assignees: {
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
    orderBy: { startTimeMin: "asc" },
  });

  // Filter to only entries whose absolute UTC instant falls in the local week
  return rows.filter((row) => {
    const utcMs = row.date.getTime() + row.startTimeMin * 60_000;
    return utcMs >= weekStartUtcMs && utcMs < weekEndUtcMs;
  });
}

/**
 * Creates a new live timetable entry.
 * Fetches the org timezone and task snapshot fields, converts the local
 * date/time to UTC, then inserts the row.
 * @param actorId - Optional caller ID forwarded from the action layer for audit log.
 */
export async function createTimetableEntry(
  orgId: string,
  taskId: string,
  dateStr: string,
  startTimeMin: number,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<
  ServiceResult<Prisma.TimetableEntryGetPayload<Record<string, never>>>
> {
  const [org, task] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    }),
    prisma.task.findFirst({
      where: { id: taskId, orgId },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        durationMin: true,
      },
    }),
  ]);
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };
  if (!task) return { ok: false, error: "Task not found", code: "NOT_FOUND" };

  const { utcDate, utcStartTimeMin } = localToUTC(
    dateStr,
    startTimeMin,
    org.timezone ?? "UTC",
  );
  const endTimeMin = Math.min(utcStartTimeMin + task.durationMin, 1440);

  const entry = await prisma.timetableEntry.create({
    data: {
      orgId,
      taskId: task.id,
      taskName: task.name,
      taskColor: task.color,
      taskDescription: task.description,
      durationMin: task.durationMin,
      date: utcDate,
      startTimeMin: utcStartTimeMin,
      endTimeMin,
    },
  });
  log.info("Timetable entry created", {
    orgId,
    entryId: entry.id,
    taskId,
  });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "entry.create",
    targetType: "TimetableEntry",
    targetId: entry.id,
    after: { taskId, taskName: task.name, dateStr, startTimeMin },
  });
  return { ok: true, data: entry };
}

/**
 * Updates the date, start time, and/or status of a live timetable entry.
 * When date or time changes, converts via `utcToLocal` + `localToUTC` so
 * the stored values remain UTC-accurate.
 */
export async function updateTimetableEntry(
  orgId: string,
  entryId: string,
  update: { startTimeMin?: number; dateStr?: string; status?: EntryStatus },
): Promise<
  ServiceResult<Prisma.TimetableEntryGetPayload<Record<string, never>>>
> {
  const entry = await prisma.timetableEntry.findFirst({
    where: { id: entryId, orgId },
    select: { id: true, durationMin: true, date: true, startTimeMin: true },
  });
  if (!entry) return { ok: false, error: "Entry not found", code: "NOT_FOUND" };

  const data: Prisma.TimetableEntryUpdateInput = {};

  if (update.status !== undefined) {
    data.status = update.status;
  }

  const needsTimeUpdate =
    update.startTimeMin !== undefined || update.dateStr !== undefined;
  if (needsTimeUpdate) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    });
    const tz = org?.timezone ?? "UTC";
    const {
      localDateStr: currentLocalDate,
      localStartTimeMin: currentLocalMin,
    } = utcToLocal(entry.date, entry.startTimeMin, tz);

    const targetLocalDate = update.dateStr ?? currentLocalDate;
    const targetLocalMin = update.startTimeMin ?? currentLocalMin;

    const { utcDate, utcStartTimeMin } = localToUTC(
      targetLocalDate,
      targetLocalMin,
      tz,
    );
    data.date = utcDate;
    data.startTimeMin = utcStartTimeMin;
    data.endTimeMin = Math.min(utcStartTimeMin + entry.durationMin, 1440);
  }

  const updated = await prisma.timetableEntry.update({
    where: { id: entryId },
    data,
  });
  log.info("Timetable entry updated", { orgId, entryId });
  return { ok: true, data: updated };
}

/**
 * Permanently deletes a live timetable entry, scoped to `orgId`.
 * @param actorId - Optional caller ID forwarded from the action layer for audit log.
 */
export async function deleteTimetableEntry(
  orgId: string,
  entryId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const entry = await prisma.timetableEntry.findFirst({
    where: { id: entryId, orgId },
    select: { id: true },
  });
  if (!entry) return { ok: false, error: "Entry not found", code: "NOT_FOUND" };

  await prisma.timetableEntry.delete({ where: { id: entryId } });
  log.info("Timetable entry deleted", { orgId, entryId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "entry.delete",
    targetType: "TimetableEntry",
    targetId: entryId,
  });
  return { ok: true, data: null };
}

/**
 * Assigns a member to a timetable entry (upsert — safe if already assigned).
 */
export async function addTimetableEntryAssignee(
  orgId: string,
  entryId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
  const [entry, membership] = await Promise.all([
    prisma.timetableEntry.findFirst({
      where: { id: entryId, orgId },
      select: { id: true },
    }),
    prisma.membership.findFirst({
      where: { id: membershipId, orgId },
      select: { id: true },
    }),
  ]);
  if (!entry) return { ok: false, error: "Entry not found", code: "NOT_FOUND" };
  if (!membership)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

  await prisma.timetableEntryAssignee.upsert({
    where: {
      timetableEntryId_membershipId: {
        timetableEntryId: entryId,
        membershipId,
      },
    },
    create: { timetableEntryId: entryId, membershipId },
    update: {},
  });
  log.info("Timetable entry assignee added", {
    orgId,
    entryId,
    membershipId,
  });
  return { ok: true, data: null };
}

/**
 * Removes a member from a timetable entry's assignee list.
 */
export async function removeTimetableEntryAssignee(
  orgId: string,
  entryId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
  const assignee = await prisma.timetableEntryAssignee.findFirst({
    where: {
      timetableEntryId: entryId,
      membershipId,
      timetableEntry: { orgId },
    },
    select: { id: true },
  });
  if (!assignee) return { ok: false, error: "Not found", code: "NOT_FOUND" };

  await prisma.timetableEntryAssignee.delete({ where: { id: assignee.id } });
  log.info("Timetable entry assignee removed", {
    orgId,
    entryId,
    membershipId,
  });
  return { ok: true, data: null };
}

/**
 * The UTC-to-local mapped shape of a timetable entry, ready for the
 * timetable calendar/simple views. `date` is a local YYYY-MM-DD string;
 * `startTimeMin` is local wall-clock minutes (0–1439).
 */
export type WeekTimetableInstance = {
  id: string;
  taskId: string;
  date: string;
  startTimeMin: number;
  taskColor: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
  scheduledStartAt: string;
  scheduledEndAt: string;
  task: {
    id: string;
    title: string;
    durationMin: number;
    preferredStartTimeMin: number | null;
  };
  assignees: Array<{
    id: string;
    membership: {
      id: string;
      botName: string | null;
      user: { id: string; name: string | null } | null;
    };
  }>;
};

/**
 * Fetches and maps timetable entries for a local calendar week.
 * Delegates to `getTimetableEntries` for the UTC-aware query, then converts
 * each row to a local-time `WeekTimetableInstance` ready for client rendering.
 */
export async function getWeekTimetableInstances(
  orgId: string,
  orgTz: string,
  weekStart: string,
): Promise<WeekTimetableInstance[]> {
  const raw = await getTimetableEntries(orgId, orgTz, weekStart);
  return raw.map((inst) => mapInstance(inst, orgTz));
}

/**
 * Fetches and maps timetable entries for an arbitrary date range.
 * Always fetches `numDays` days starting from `startDate` (YYYY-MM-DD).
 * Used by the adaptive calendar view which centers on an anchor date and
 * needs data for `anchor ± floor(numDays/2)` without any week-boundary
 * snapping — 9 days covers any colCount ≤ 7 (max half = 3).
 */
export async function getRangeTimetableInstances(
  orgId: string,
  orgTz: string,
  startDate: string,
  numDays: number,
): Promise<WeekTimetableInstance[]> {
  const MS_DAY = 86_400_000;
  const startUtcMs = localMidnightUTC(startDate, orgTz);
  const endUtcMs = localMidnightUTC(addCalendarDays(startDate, numDays), orgTz);

  const queryFrom = new Date(Math.floor(startUtcMs / MS_DAY) * MS_DAY - MS_DAY);
  const queryTo = new Date(Math.floor(endUtcMs / MS_DAY) * MS_DAY + MS_DAY * 2);

  const rows = await prisma.timetableEntry.findMany({
    where: { orgId, date: { gte: queryFrom, lt: queryTo } },
    include: {
      task: true,
      assignees: {
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
    orderBy: { startTimeMin: "asc" },
  });

  return rows
    .filter((row) => {
      const utcMs = row.date.getTime() + row.startTimeMin * 60_000;
      return utcMs >= startUtcMs && utcMs < endUtcMs;
    })
    .map((inst) => mapInstance(inst, orgTz));
}

function mapInstance(
  inst: TimetableInstance,
  orgTz: string,
): WeekTimetableInstance {
  const { localDateStr: date, localStartTimeMin } = utcToLocal(
    inst.date,
    inst.startTimeMin,
    orgTz,
  );
  const startMs = inst.date.getTime() + inst.startTimeMin * 60_000;
  const endMs = inst.date.getTime() + inst.endTimeMin * 60_000;
  return {
    id: inst.id,
    taskId: inst.taskId,
    date,
    startTimeMin: localStartTimeMin,
    taskColor: inst.taskColor,
    status: inst.status as WeekTimetableInstance["status"],
    scheduledStartAt: new Date(startMs).toISOString(),
    scheduledEndAt: new Date(endMs).toISOString(),
    task: {
      id: inst.task.id,
      title: inst.task.name,
      durationMin: inst.task.durationMin,
      preferredStartTimeMin: inst.task.preferredStartTimeMin,
    },
    assignees: inst.assignees.map((a) => ({
      id: a.id,
      membership: {
        id: a.membership.id,
        botName: a.membership.botName,
        user: a.membership.user
          ? { id: a.membership.user.id, name: a.membership.user.name }
          : null,
      },
    })),
  };
}
