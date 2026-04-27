import { log } from "@/lib/observability";
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

export type NotificationItem = {
  id: string;
  message: string;
  seenAt: Date | null;
  createdAt: Date;
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
 * Returns in-app notifications for a user (newest first), limited to 30.
 */
export async function getNotificationsForUser(
  userId: string,
): Promise<NotificationItem[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, message: true, seenAt: true, createdAt: true },
  });
}

/**
 * Returns the count of unseen notifications for a user.
 */
export async function getUnseenNotificationCount(
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: { userId, seenAt: null },
  });
}

/** Marks all unseen notifications for a user as seen. */
export async function markNotificationsSeen(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, seenAt: null },
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
  botMembershipId?: string,
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

  // If this is a bot-slot invite, validate the bot membership exists and is actually a bot
  if (botMembershipId) {
    const botMembership = await prisma.membership.findUnique({
      where: { id: botMembershipId, orgId },
      select: { id: true, userId: true },
    });
    if (!botMembership)
      return {
        ok: false,
        error: "Bot membership not found",
        code: "NOT_FOUND",
      };
    if (botMembership.userId !== null) {
      log.warn("Conflict: bot membership slot already occupied", {
        orgId,
        botMembershipId,
      });
      return {
        ok: false,
        error: "Membership slot is already occupied by a real user",
        code: "CONFLICT",
      };
    }
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: recipientId, orgId } },
  });
  if (existingMembership) {
    log.warn("Conflict: user already a member", {
      orgId,
      recipientId,
    });
    return {
      ok: false,
      error: "This user is already a member",
      code: "CONFLICT",
    };
  }

  const existingInvite = await prisma.invite.findFirst({
    where: { orgId, recipientId, type: InviteType.MEMBER, status: "PENDING" },
  });
  if (existingInvite) {
    log.warn("Conflict: pending invite already exists", {
      orgId,
      recipientId,
    });
    return {
      ok: false,
      error: "This user already has a pending invite",
      code: "CONFLICT",
    };
  }

  try {
    await prisma.invite.create({
      data: {
        orgId,
        invitedById,
        recipientId,
        type: InviteType.MEMBER,
        orgName: org.name,
        inviterName: inviter?.name ?? null,
        metadata: {
          roleIds,
          workingDays,
          ...(botMembershipId ? { botMembershipId } : {}),
        },
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

  log.info("Member invite created", {
    orgId,
    invitedById,
    recipientId,
  });
  return { ok: true, data: null };
}

/**
 * Accepts a pending member invite atomically.
 * Creates a new Membership + MemberRole rows in a transaction.
 * For bot-slot invites use acceptBotSlotInvite instead.
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
  if (invite.status !== "PENDING") {
    log.warn("Conflict: invite no longer pending", {
      inviteId,
      userId,
    });
    return {
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    };
  }
  if (invite.expiresAt && invite.expiresAt < new Date())
    return { ok: false, error: "This invite has expired", code: "INVALID" };

  const meta = invite.metadata as {
    roleIds?: string[];
    workingDays?: string[];
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
              where: { id: { in: meta.roleIds }, orgId: invite.orgId },
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
    if (e instanceof Error && e.message === "ALREADY_HANDLED") {
      log.warn("Conflict: member invite already handled", {
        inviteId,
        userId,
      });
      return {
        ok: false,
        error: "This invite has already been handled",
        code: "CONFLICT",
      };
    }
    if (e && typeof e === "object" && "code" in e) {
      const prismaCode = (e as { code?: string }).code;
      if (prismaCode === "P2002" || prismaCode === "P2003") {
        log.warn("Conflict: membership or role DB conflict", {
          inviteId,
          userId,
        });
        return {
          ok: false,
          error: "Membership or role conflict",
          code: "CONFLICT",
        };
      }
    }
    throw e;
  }

  await notifyInviteAccepted(invite, userId);
  log.info("Member invite accepted", {
    inviteId,
    userId,
    orgId: invite.orgId,
  });
  return { ok: true, data: null };
}

/**
 * Accepts a pending bot-slot invite.
 * Slots the user into the existing bot membership row (userId = user, botName = null).
 * The bot membership's working days and roles are replaced with those from the invite.
 */
export async function acceptBotSlotInvite(
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
  if (invite.status !== "PENDING") {
    log.warn("Conflict: bot-slot invite no longer pending", {
      inviteId,
      userId,
    });
    return {
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    };
  }
  if (invite.expiresAt && invite.expiresAt < new Date())
    return { ok: false, error: "This invite has expired", code: "INVALID" };

  const meta = invite.metadata as {
    roleIds?: string[];
    workingDays?: string[];
    botMembershipId: string;
  } | null;

  if (!meta?.botMembershipId)
    return { ok: false, error: "Invalid bot-slot invite", code: "INVALID" };

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.invite.updateMany({
        where: { id: inviteId, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (updated.count === 0) throw new Error("ALREADY_HANDLED");

      const bot = await tx.membership.findUnique({
        where: { id: meta.botMembershipId, orgId: invite.orgId },
        select: { id: true, userId: true },
      });
      if (!bot || bot.userId !== null) throw new Error("BOT_SLOT_TAKEN");

      // Slot the user in — clear botName, set userId, always replace workingDays
      await tx.membership.update({
        where: { id: meta.botMembershipId },
        data: {
          userId,
          botName: null,
          workingDays: meta.workingDays ?? [],
        },
      });

      // Always replace roles — delete bot's old roles and apply the invited ones
      const validRoleIds = meta.roleIds?.length
        ? (
            await tx.role.findMany({
              where: { id: { in: meta.roleIds }, orgId: invite.orgId },
              select: { id: true },
            })
          ).map((r) => r.id)
        : [];

      await tx.memberRole.deleteMany({
        where: { membershipId: meta.botMembershipId },
      });
      if (validRoleIds.length) {
        await tx.memberRole.createMany({
          data: validRoleIds.map((roleId) => ({
            membershipId: meta.botMembershipId,
            roleId,
          })),
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_HANDLED") {
      log.warn("Conflict: bot-slot invite already handled", {
        inviteId,
        userId,
      });
      return {
        ok: false,
        error: "This invite has already been handled",
        code: "CONFLICT",
      };
    }
    if (e instanceof Error && e.message === "BOT_SLOT_TAKEN") {
      log.warn("Conflict: bot slot already filled", {
        inviteId,
        userId,
      });
      return {
        ok: false,
        error: "The bot slot was already filled by another user",
        code: "CONFLICT",
      };
    }
    if (e && typeof e === "object" && "code" in e) {
      const prismaCode = (e as { code?: string }).code;
      if (prismaCode === "P2002" || prismaCode === "P2003") {
        log.warn("Conflict: membership DB conflict on bot-slot", {
          inviteId,
          userId,
        });
        return { ok: false, error: "Membership conflict", code: "CONFLICT" };
      }
    }
    throw e;
  }

  await notifyInviteAccepted(invite, userId);
  log.info("Bot-slot invite accepted", {
    inviteId,
    userId,
    orgId: invite.orgId,
  });
  return { ok: true, data: null };
}

/**
 * Declines a pending bot-slot invite.
 */
export async function declineBotSlotInvite(
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

  log.info("Bot-slot invite declined", { inviteId, userId });
  return { ok: true, data: null };
}

/** Shared helper: notify the inviter that their invite was accepted. */
async function notifyInviteAccepted(
  invite: { invitedById: string | null; orgName: string },
  acceptingUserId: string,
): Promise<void> {
  if (!invite.invitedById) return;
  try {
    const acceptingUser = await prisma.user.findUnique({
      where: { id: acceptingUserId },
      select: { name: true },
    });
    await prisma.notification.create({
      data: {
        userId: invite.invitedById,
        message: `${acceptingUser?.name ?? "Someone"} accepted your invitation to ${invite.orgName}.`,
      },
    });
  } catch (error) {
    log.error("Failed to create notification for invite acceptance", {
      error,
      acceptingUserId,
    });
  }
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

  log.info("Member invite declined", { inviteId, userId });
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
  if (invite.status !== "PENDING") {
    log.warn("Conflict: franchise invite no longer pending", {
      inviteId,
      userId,
    });
    return {
      ok: false,
      error: "This invite is no longer pending",
      code: "CONFLICT",
    };
  }

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
    if (e instanceof Error && e.message === "ALREADY_HANDLED") {
      log.warn("Conflict: franchise invite already handled", {
        inviteId,
        userId,
      });
      return {
        ok: false,
        error: "This invite has already been handled",
        code: "CONFLICT",
      };
    }
    throw e;
  }

  log.info("Franchise invite declined", {
    inviteId,
    userId,
    orgId: invite.orgId,
  });
  return { ok: true, data: null };
}
