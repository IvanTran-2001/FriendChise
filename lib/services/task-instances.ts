import { prisma } from "@/lib/prisma";
import { Prisma, TaskInstanceStatus } from "@prisma/client";
import type { ServiceResult } from "./types";

/** Options for filtering the task instances returned by `getTaskInstances`. */
export type GetTaskInstancesOptions = {
  status?: TaskInstanceStatus;
  completed?: boolean;
};

/**
 * Creates a new task instance for the given org and task.
 * Validates that the task belongs to the org before inserting so crafted
 * `taskId` values from other orgs are rejected with a clear INVALID error.
 */
export async function createTaskInstance(
  orgId: string,
  taskId: string,
): Promise<
  ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>
> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, orgId },
    select: { id: true },
  });
  if (!task) {
    return {
      ok: false,
      error: "Invalid taskId: not found or does not belong to this org",
      code: "INVALID",
    };
  }

  try {
    const taskInstance = await prisma.taskInstance.create({
      data: { orgId, taskId },
    });
    return { ok: true, data: taskInstance };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Task removed (or relation invalid) between pre-check and create
      if (e.code === "P2003") {
        return {
          ok: false,
          error: "Invalid taskId: not found or does not belong to this org",
          code: "INVALID",
        };
      }
      // Keep this only if a corresponding unique constraint is added in schema.
      if (e.code === "P2002") {
        return {
          ok: false,
          error: "Task instance already exists",
          code: "CONFLICT",
        };
      }
    }
    throw e;
  }
}

/**
 * Lists task instances for an org with optional status filtering.
 * `status` and `completed` are mutually exclusive:
 *   - `status`: filter to an exact TaskInstanceStatus value
 *   - `completed: true`:  only DONE or SKIPPED
 *   - `completed: false`: exclude DONE and SKIPPED
 */
export async function getTaskInstances(
  orgId: string,
  options: GetTaskInstancesOptions = {},
) {
  const where: Prisma.TaskInstanceWhereInput = { orgId };

  if (options.status != null) {
    where.status = options.status;
  } else if (options.completed === false) {
    where.status = {
      notIn: [TaskInstanceStatus.DONE, TaskInstanceStatus.SKIPPED],
    };
  } else if (options.completed === true) {
    where.status = {
      in: [TaskInstanceStatus.DONE, TaskInstanceStatus.SKIPPED],
    };
  }

  return prisma.taskInstance.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetches a single task instance by id, scoped to `orgId`.
 * Returns NOT_FOUND if the instance does not exist in this org.
 */
export async function getTaskInstance(
  orgId: string,
  taskInstanceId: string,
): Promise<
  ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>
> {
  const item = await prisma.taskInstance.findFirst({
    where: { orgId, id: taskInstanceId },
  });
  if (!item)
    return {
      ok: false,
      error: "Task instance not found in this org",
      code: "NOT_FOUND",
    };
  return { ok: true, data: item };
}

/**
 * Updates the status of a task instance inside a transaction.
 * Uses `updateMany` (scoped by orgId) to detect missing records without an
 * extra query, then re-fetches the updated row to return to the caller.
 */
export async function updateTaskInstanceStatus(
  orgId: string,
  taskInstanceId: string,
  status: TaskInstanceStatus,
): Promise<
  ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>
> {
  try {
    const taskInstance = await prisma.$transaction(async (tx) => {
      const updated = await tx.taskInstance.updateMany({
        where: { id: taskInstanceId, orgId },
        data: { status },
      });

      if (updated.count === 0) {
        throw Object.assign(new Error("Task instance not found in this org"), {
          code: "NOT_FOUND",
        });
      }

      const instance = await tx.taskInstance.findUnique({
        where: { id: taskInstanceId },
      });
      if (!instance) {
        throw Object.assign(new Error("Task instance not found in this org"), {
          code: "NOT_FOUND",
        });
      }

      return instance;
    });

    return { ok: true, data: taskInstance };
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "NOT_FOUND") {
      return { ok: false, error: e.message, code: "NOT_FOUND" };
    }
    throw e;
  }
}

/** Full instance shape used by the timetable view. */
export type TimetableInstance = Prisma.TaskInstanceGetPayload<{
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
 * Fetches task instances within a UTC date range for the timetable view.
 * Only instances with a scheduledStartAt in [from, to) are returned.
 * Includes task details and assignee/user data needed to render blocks.
 */
export async function getTaskInstancesForTimetable(
  orgId: string,
  from: Date,
  to: Date,
): Promise<TimetableInstance[]> {
  return prisma.taskInstance.findMany({
    where: {
      orgId,
      scheduledStartAt: { gte: from, lt: to },
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
    orderBy: { scheduledStartAt: "asc" },
  });
}
