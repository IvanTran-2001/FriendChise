import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ServiceResult } from "./types";

/**
 * Assigns a member to a timetable entry. Validates that both the entry
 * and the membership belong to the same org before creating the link,
 * preventing cross-org assignment via crafted IDs.
 */
export async function createAssignee(
  orgId: string,
  taskInstanceId: string,
  membershipId: string,
): Promise<
  ServiceResult<Prisma.TimetableEntryAssigneeGetPayload<Record<string, never>>>
> {
  const entry = await prisma.timetableEntry.findFirst({
    where: { id: taskInstanceId, orgId },
    select: { id: true },
  });
  if (!entry) {
    return {
      ok: false,
      error: "Timetable entry not found in this org",
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
    const assignee = await prisma.timetableEntryAssignee.create({
      data: { timetableEntryId: taskInstanceId, membershipId },
    });
    log.info("Assignee added", {
      orgId,
      taskInstanceId,
      membershipId,
    });
    return { ok: true, data: assignee };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      log.warn("Conflict: assignee already exists", {
        orgId,
        taskInstanceId,
        membershipId,
      });
      return { ok: false, error: "Assignee already exists", code: "CONFLICT" };
    }
    throw e;
  }
}

/**
 * Removes a member from a timetable entry. Verifies org ownership of both
 * the entry and the membership before deleting to prevent cross-org
 * manipulation via crafted IDs.
 */
export async function deleteAssignee(
  orgId: string,
  taskInstanceId: string,
  membershipId: string,
): Promise<ServiceResult<null>> {
  const link = await prisma.timetableEntryAssignee.findFirst({
    where: {
      timetableEntryId: taskInstanceId,
      membershipId,
      timetableEntry: { is: { orgId } },
      membership: { is: { orgId } },
    },
    select: { id: true },
  });

  if (!link)
    return { ok: false, error: "Assignee not found", code: "NOT_FOUND" };

  await prisma.timetableEntryAssignee.delete({ where: { id: link.id } });
  log.info("Assignee removed", {
    orgId,
    taskInstanceId,
    membershipId,
  });
  return { ok: true, data: null };
}

/**
 * Returns all assignees for a timetable entry, scoped to `orgId`.
 * Each assignee includes the linked membership with user name and role name.
 */
export async function getAssignees(orgId: string, taskInstanceId: string) {
  return prisma.timetableEntryAssignee.findMany({
    where: {
      timetableEntryId: taskInstanceId,
      timetableEntry: { is: { orgId } },
    },
    include: {
      membership: {
        include: {
          user: { select: { id: true, name: true } },
          memberRoles: {
            include: { role: { select: { id: true, name: true } } },
            take: 1, // Return only the first/primary role for display purposes
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
