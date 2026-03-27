import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { CreateMembershipInput } from "@/lib/validators/membership";
import type { ServiceResult } from "./types";

/**
 * Creates a membership linking a user to an org, then assigns the specified
 * role via the MemberRole junction. Both operations are wrapped in a single
 * transaction so a partial write is never possible.
 */
export async function createMembership(
  orgId: string,
  data: CreateMembershipInput,
): Promise<ServiceResult<Prisma.MembershipGetPayload<Record<string, never>>>> {
  const role = await prisma.role.findFirst({
    where: { id: data.roleId, orgId },
  });
  if (!role) {
    return {
      ok: false,
      error: "Invalid roleId: not found or does not belong to this org",
      code: "INVALID",
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, error: "Invalid userId: not found", code: "INVALID" };
  }

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const m = await tx.membership.create({
        data: { orgId, userId: data.userId, workingDays: [] },
      });
      await tx.memberRole.create({
        data: { membershipId: m.id, roleId: data.roleId },
      });
      return m;
    });
    return { ok: true, data: membership };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002")
        return {
          ok: false,
          error: "Membership already exists",
          code: "CONFLICT",
        };
      if (e.code === "P2003")
        return {
          ok: false,
          error: "Invalid foreign key reference",
          code: "INVALID",
        };
    }
    throw e;
  }
}

/**
 * Removes a user from an org. Guards against removing the org owner,
 * which would leave the org with no owner and break invariants.
 */
export async function deleteMembership(
  orgId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };

  if (userId === org.ownerId) {
    return {
      ok: false,
      error: "Cannot remove the organization owner",
      code: "INVALID",
    };
  }

  const { count } = await prisma.membership.deleteMany({
    where: { userId, orgId },
  });
  if (count === 0)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

  return { ok: true, data: null };
}

/**
 * Returns all memberships for an org, including the linked user (id + name)
 * and role, sorted newest-first.
 */
export async function getMemberships(orgId: string) {
  return prisma.membership.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, name: true } },
      memberRoles: { include: { role: true } },
    },
    orderBy: { joinedAt: "desc" },
  });
}
