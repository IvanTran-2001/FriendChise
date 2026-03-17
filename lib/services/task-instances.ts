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
): Promise<ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>> {
  const task = await prisma.task.findFirst({ where: { id: taskId, orgId }, select: { id: true } });
  if (!task) {
    return { ok: false, error: "Invalid taskId: not found or does not belong to this org", code: "INVALID" };
  }

  try {
    const taskInstance = await prisma.taskInstance.create({ data: { orgId, taskId } });
    return { ok: true, data: taskInstance };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Task instance already exists", code: "CONFLICT" };
    }
    throw e;
  }
}

export async function getTaskInstances(orgId: string, options: GetTaskInstancesOptions = {}) {
  const where: Prisma.TaskInstanceWhereInput = { orgId };

  if (options.status != null) {
    where.status = options.status;
  } else if (options.completed === false) {
    where.status = { notIn: [TaskInstanceStatus.DONE, TaskInstanceStatus.SKIPPED] };
  } else if (options.completed === true) {
    where.status = { in: [TaskInstanceStatus.DONE, TaskInstanceStatus.SKIPPED] };
  }

  return prisma.taskInstance.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function getTaskInstance(
  orgId: string,
  taskInstanceId: string,
): Promise<ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>> {
  const item = await prisma.taskInstance.findFirst({ where: { orgId, id: taskInstanceId } });
  if (!item) return { ok: false, error: "Task instance not found in this org", code: "NOT_FOUND" };
  return { ok: true, data: item };
}

export async function updateTaskInstanceStatus(
  orgId: string,
  taskInstanceId: string,
  status: TaskInstanceStatus,
): Promise<ServiceResult<Prisma.TaskInstanceGetPayload<Record<string, never>>>> {
  const updated = await prisma.taskInstance.updateMany({
    where: { id: taskInstanceId, orgId },
    data: { status },
  });

  if (updated.count === 0) {
    return { ok: false, error: "Task instance not found in this org", code: "NOT_FOUND" };
  }

  const taskInstance = await prisma.taskInstance.findUnique({ where: { id: taskInstanceId } });
  return { ok: true, data: taskInstance! };
}
