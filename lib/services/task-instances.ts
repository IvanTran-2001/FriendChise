import { prisma } from "@/lib/prisma";
import { Prisma, EntryStatus } from "@prisma/client";
import type { ServiceResult } from "./types";
import type { CreateTaskInstanceInput } from "@/lib/validators/task-instance";

/** Options for filtering timetable entries returned by `getTaskInstances`. */
export type GetTaskInstancesOptions = {
  status?: EntryStatus;
  completed?: boolean;
};

/**
 * Creates a new timetable entry for the given org and task.
 * Validates that the task belongs to the org before inserting and
 * auto-populates snapshot fields (taskName, durationMin, etc.) from the task.
 */
export async function createTaskInstance(
  orgId: string,
  data: CreateTaskInstanceInput,
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

  const endTimeMin = data.endTimeMin ?? data.startTimeMin + task.durationMin;

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
export async function getTaskInstances(
  orgId: string,
  options: GetTaskInstancesOptions = {},
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
export async function getTaskInstance(
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
export async function updateTaskInstanceStatus(
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
        throw Object.assign(new Error("Timetable entry not found in this org"), {
          code: "NOT_FOUND",
        });
      }

      const item = await tx.timetableEntry.findUnique({
        where: { id: taskInstanceId },
      });
      if (!item) {
        throw Object.assign(new Error("Timetable entry not found in this org"), {
          code: "NOT_FOUND",
        });
      }

      return item;
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
 * Fetches timetable entries within a date range for the calendar view.
 * Entries whose `date` falls in [from, to) are returned, ordered by
 * startTimeMin ascending. Includes task details and assignee/user data.
 */
export async function getTaskInstancesForTimetable(
  orgId: string,
  from: Date,
  to: Date,
): Promise<TimetableInstance[]> {
  return prisma.timetableEntry.findMany({
    where: {
      orgId,
      date: { gte: from, lt: to },
    },
    include: {
      task: true,
      assignees: {
        include: {
          membership: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { startTimeMin: "asc" },
  });
}
