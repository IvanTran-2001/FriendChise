import { prisma } from "@/lib/prisma";
import { Prisma, InviteType } from "@prisma/client";
import type { CreateMembershipInput } from "@/lib/validators/membership";
import type { ServiceResult } from "./types";
import { ROLE_KEYS } from "@/lib/rbac";

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
  membershipId: string,
): Promise<ServiceResult<null>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    select: { userId: true },
  });
  if (!membership)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };

  if (membership.userId !== null && membership.userId === org.ownerId) {
    return {
      ok: false,
      error: "Cannot remove the organization owner",
      code: "INVALID",
    };
  }

  await prisma.$transaction(async (tx) => {
    // Cancel any lingering pending MEMBER invites only if userId is non-null
    if (membership.userId !== null) {
      await tx.invite.updateMany({
        where: {
          orgId,
          recipientId: membership.userId,
          type: InviteType.MEMBER,
          status: "PENDING",
        },
        data: { status: "DECLINED", declinedAt: new Date() },
      });
    }
    // Cancel any pending BOT_SLOT invites pointing to this membership
    await tx.invite.updateMany({
      where: {
        orgId,
        type: InviteType.MEMBER,
        status: "PENDING",
        metadata: {
          path: ["botMembershipId"],
          equals: membershipId,
        },
      },
      data: { status: "DECLINED", declinedAt: new Date() },
    });
    await tx.membership.delete({ where: { id: membershipId } });
  });
  return { ok: true, data: null };
}

/**
 * Returns all memberships for an org, including the linked user (id + name)
 * and role, sorted newest-first.
 */
export async function getMemberships(orgId: string) {
  return prisma.membership.findMany({
    where: { orgId },
    select: {
      id: true,
      userId: true,
      botName: true,
      status: true,
      joinedAt: true,
      workingDays: true,
      user: { select: { id: true, name: true, image: true } },
      memberRoles: { include: { role: true } },
    },
    orderBy: { joinedAt: "desc" },
  });
}

/**
 * Returns a single membership by orgId + userId, with full user and role
 * details needed for the member detail page. Returns null if not found.
 */
export async function getMembershipDetail(orgId: string, membershipId: string) {
  return prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      memberRoles: { include: { role: true } },
    },
  });
}

/**
 * Updates a membership's working days and role assignment.
 * Replaces all existing MemberRole rows with the new roles in a
 * transaction so the state is always consistent.
 */
export async function updateMembership(
  orgId: string,
  membershipId: string,
  data: { workingDays: string[]; roleIds: string[] },
): Promise<ServiceResult<null>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    select: { id: true },
  });
  if (!membership)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };

  if (data.roleIds.length === 0)
    return {
      ok: false,
      error: "At least one role is required",
      code: "INVALID",
    };

  const validRoles = await prisma.role.findMany({
    where: { id: { in: data.roleIds }, orgId },
    select: { id: true, key: true },
  });
  if (validRoles.length !== data.roleIds.length)
    return { ok: false, error: "One or more roles not found", code: "INVALID" };

  if (validRoles.some((r) => r.key === ROLE_KEYS.OWNER))
    return {
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    };

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { workingDays: data.workingDays },
    });
    await tx.memberRole.deleteMany({ where: { membershipId: membership.id } });
    await Promise.all(
      data.roleIds.map((roleId) =>
        tx.memberRole.create({ data: { membershipId: membership.id, roleId } }),
      ),
    );
  });

  return { ok: true, data: null };
}

/**
 * Toggles a membership's status between ACTIVE and RESTRICTED.
 */
export async function setMembershipStatus(
  orgId: string,
  membershipId: string,
  status: "ACTIVE" | "RESTRICTED",
): Promise<ServiceResult<null>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    select: { id: true },
  });
  if (!membership)
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };
  await prisma.membership.update({
    where: { id: membershipId },
    data: { status },
  });
  return { ok: true, data: null };
}