import { InviteType } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "./types";

export type InviteItem = {
  id: string;
  type: "MEMBER" | "FRANCHISE";
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  orgId: string;
  orgName: string;
  inviterName: string | null;
  seenAt: Date | null;
  createdAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  metadata: unknown;
};

/**
 * Returns all invites visible in the notification panel for a user:
 * - All PENDING invites (always shown)
 * - ACCEPTED / DECLINED invites within 7 days of being handled
 *   (so resolved notifications fade away naturally)
 */
export async function getInvitesForUser(userId: string): Promise<InviteItem[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const invites = await prisma.invite.findMany({
    where: {
      recipientId: userId,
      OR: [
        { status: "PENDING" },
        { status: "ACCEPTED", acceptedAt: { gte: sevenDaysAgo } },
        { status: "DECLINED", declinedAt: { gte: sevenDaysAgo } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      orgId: true,
      orgName: true,
      inviterName: true,
      seenAt: true,
      createdAt: true,
      acceptedAt: true,
      declinedAt: true,
      metadata: true,
    },
  });

  return invites as InviteItem[];
}

/**
 * Returns the count of unseen (unread) invites for a user.
 * Used for the notification badge on the bell icon.
 * Applies the same visibility filter as getInvitesForUser.
 */
export async function getUnseenInviteCount(userId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return prisma.invite.count({
    where: {
      recipientId: userId,
      seenAt: null,
      OR: [
        { status: "PENDING" },
        { status: "ACCEPTED", acceptedAt: { gte: sevenDaysAgo } },
        { status: "DECLINED", declinedAt: { gte: sevenDaysAgo } },
      ],
    },
  });
}

export async function markInvitesSeen(userId: string): Promise<void> {
  await prisma.invite.updateMany({
    where: { recipientId: userId, seenAt: null },
    data: { seenAt: new Date() },
  });
}

/**
 * Creates a member invite.
 * Validates roles, guards against duplicate membership/invite, then inserts the Invite row.
 */
export async function createMemberInvite(
  orgId: string,
  invitedById: string | null,
  recipientId: string,
  roleIds: string[],
  workingDays: string[],
): Promise<ServiceResult<null>> {
  const [org, inviter, validRoles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    invitedById
      ? prisma.user.findUnique({
          where: { id: invitedById },
          select: { name: true },
        })
      : null,
    prisma.role.findMany({
      where: { id: { in: roleIds }, orgId },
      select: { id: true, key: true },
    }),
  ]);

  if (!org)
    return { ok: false, error: "Organization not found", code: "NOT_FOUND" };
  if (validRoles.length !== roleIds.length)
    return { ok: false, error: "One or more roles not found", code: "INVALID" };
  if (validRoles.some((r) => r.key === ROLE_KEYS.OWNER))
    return {
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    };

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: recipientId, orgId } },
  });
  if (existingMembership)
    return {
      ok: false,
      error: "This user is already a member",
      code: "CONFLICT",
    };

  const existingInvite = await prisma.invite.findFirst({
    where: { orgId, recipientId, type: InviteType.MEMBER, status: "PENDING" },
  });
  if (existingInvite)
    return {
      ok: false,
      error: "This user already has a pending invite",
      code: "CONFLICT",
    };

  try {
    await prisma.invite.create({
      data: {
        orgId,
        invitedById,
        recipientId,
        type: InviteType.MEMBER,
        orgName: org.name,
        inviterName: inviter?.name ?? null,
        metadata: { roleIds, workingDays },
      },
    });
  } catch (e) {
    // Handle DB-level unique constraint violation (concurrent request race condition)
    if (e && typeof e === "object" && "code" in e) {
      const prismaCode = (e as { code?: string }).code;
      if (prismaCode === "P2002") {
        return {
          ok: false,
          error: "This user already has a pending invite",
          code: "CONFLICT",
        };
      }
    }
    throw e;
  }

  return { ok: true, data: null };
}

/**
 * Accepts a pending member invite atomically.
 * Creates the Membership + MemberRole rows in a transaction.
 */
export async function acceptMemberInvite(
  inviteId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (
    !invite ||
    invite.recipientId !== userId ||
    invite.type !== InviteType.MEMBER
  )
    return { ok: false, error: "Invite not found", code: "NOT_FOUND" };
  if (invite.status !== "PENDING")
    return {
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    };
  if (invite.expiresAt && invite.expiresAt < new Date())
    return { ok: false, error: "This invite has expired", code: "INVALID" };

  const meta = invite.metadata as {
    roleIds: string[];
    workingDays: string[];
  } | null;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.invite.updateMany({
        where: { id: inviteId, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (updated.count === 0) throw new Error("ALREADY_HANDLED");

      const validRoleIds = meta?.roleIds?.length
        ? (
            await tx.role.findMany({
              where: {
                id: { in: meta.roleIds },
                orgId: invite.orgId,
              },
              select: { id: true },
            })
          ).map((r) => r.id)
        : [];

      const m = await tx.membership.upsert({
        where: { userId_orgId: { userId, orgId: invite.orgId } },
        create: {
          orgId: invite.orgId,
          userId,
          workingDays: meta?.workingDays ?? [],
        },
        update: {},
      });

      if (validRoleIds.length) {
        await tx.memberRole.createMany({
          data: validRoleIds.map((roleId) => ({ membershipId: m.id, roleId })),
          skipDuplicates: true,
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_HANDLED")
      return {
        ok: false,
        error: "This invite has already been handled",
        code: "CONFLICT",
      };
    // Handle Prisma constraint errors
    if (e && typeof e === "object" && "code" in e) {
      const prismaCode = (e as { code?: string }).code;
      if (prismaCode === "P2002" || prismaCode === "P2003")
        return {
          ok: false,
          error: "Membership or role conflict",
          code: "CONFLICT",
        };
    }
    throw e;
  }

  return { ok: true, data: null };
}

/**
 * Declines a pending member invite.
 */
export async function declineMemberInvite(
  inviteId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  const updated = await prisma.invite.updateMany({
    where: {
      id: inviteId,
      recipientId: userId,
      type: InviteType.MEMBER,
      status: "PENDING",
    },
    data: { status: "DECLINED", declinedAt: new Date() },
  });

  if (updated.count === 0)
    return {
      ok: false,
      error: "Invite not found or already handled",
      code: "NOT_FOUND",
    };

  return { ok: true, data: null };
}

/**
 * Declines a pending franchise invite.
 * Marks the invite as DECLINED and expires the associated FranchiseToken immediately.
 */
export async function declineFranchiseInvite(
  inviteId: string,
  userId: string,
): Promise<ServiceResult<null>> {
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (
    !invite ||
    invite.recipientId !== userId ||
    invite.type !== InviteType.FRANCHISE
  )
    return { ok: false, error: "Invite not found", code: "NOT_FOUND" };
  if (invite.status !== "PENDING")
    return {
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    };

  const meta = invite.metadata as { token?: string } | null;

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.invite.updateMany({
        where: { id: inviteId, status: "PENDING" },
        data: { status: "DECLINED", declinedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new Error("ALREADY_HANDLED");
      }

      // Expire the franchise token so it can no longer be used
      if (meta?.token) {
        await tx.franchiseToken.updateMany({
          where: { token: meta.token, orgId: invite.orgId },
          data: { expiresAt: new Date() },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_HANDLED")
      return {
        ok: false,
        error: "This invite has already been handled",
        code: "CONFLICT",
      };
    throw e;
  }

  return { ok: true, data: null };
}
