import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ServiceResult } from "./types";

/**
 * Assigns a member to a task instance. Validates that both the task instance
 * and the membership belong to the same org before creating the link,
 * preventing cross-org assignment via crafted IDs.
 */
export async function createAssignee(
  orgId: string,
  taskInstanceId: string,
  membershipId: string,
): Promise<
  ServiceResult<Prisma.TaskInstanceAssigneeGetPayload<Record<string, never>>>
> {
  const taskInstance = await prisma.taskInstance.findFirst({
    where: { id: taskInstanceId, orgId },
    select: { id: true },
  });
  if (!taskInstance) {
    return {
      ok: false,
      error: "Task instance not found in this org",
      code: "NOT_FOUND",
    };
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
    select: { id: true },
  });
  if (!membership) {
    return {
      ok: false,
      error: "Membership not found in this org",
      code: "NOT_FOUND",
    };
  }

  try {
    const assignee = await prisma.taskInstanceAssignee.create({
      data: { taskInstanceId, membershipId },
    });
    return { ok: true, data: assignee };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "Assignee already exists", code: "CONFLICT" };
    }
    throw e;
  }
}

export async function deleteAssignee(
  orgId: string,
  taskInstanceId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
  const link = await prisma.taskInstanceAssignee.findFirst({
    where: {
      taskInstanceId,
      membershipId,
      taskInstance: { is: { orgId } },
      membership: { is: { orgId } },
    },
    select: { id: true },
  });

  if (!link)
    return { ok: false, error: "Assignee not found", code: "NOT_FOUND" };

  await prisma.taskInstanceAssignee.delete({ where: { id: link.id } });
  return { ok: true, data: null };
}

export async function getAssignees(orgId: string, taskInstanceId: string) {
  return prisma.taskInstanceAssignee.findMany({
    where: {
      taskInstanceId,
      taskInstance: { is: { orgId } },
    },
    include: {
      membership: {
        include: {
          user: { select: { id: true, name: true } },
          role: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
