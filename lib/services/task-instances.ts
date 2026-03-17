import { prisma } from "@/lib/prisma";
import { Prisma, TaskInstanceStatus } from "@prisma/client";
import type { ServiceResult } from "./types";

export type GetTaskInstancesOptions = {
  status?: TaskInstanceStatus;
  completed?: boolean;
};

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
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Task instance already exists",
        code: "CONFLICT",
      };
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
