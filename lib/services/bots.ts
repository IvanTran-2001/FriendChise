import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { Prisma, InviteType } from "@prisma/client";
import { recordAudit } from "@/lib/services/audit-log";
import type { ServiceResult } from "./types";
import type {
  MemberToBotInput,
  BotToMemberInput,
  UpdateBotInput,
} from "@/lib/validators/bot";
import { ROLE_KEYS } from "@/lib/rbac";

// ─────────────────────────────────────────────────────────────────────────────
// Selects
// ─────────────────────────────────────────────────────────────────────────────

const botSelect = {
  id: true,
  botName: true,
  orgId: true,
  workingDays: true,
  status: true,
  joinedAt: true,
  memberRoles: { include: { role: true } },
} as const;

type BotMembership = Prisma.MembershipGetPayload<{ select: typeof botSelect }>;

// ─────────────────────────────────────────────────────────────────────────────
// createBot
// Creates a placeholder membership with no userId.
// actorId — optional caller ID forwarded from the action layer for audit log.
// ─────────────────────────────────────────────────────────────────────────────

export async function createBot(
  orgId: string,
  data: { botName: string; roleIds: string[]; workingDays?: string[] },
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<BotMembership>> {
  if (data.roleIds.length === 0) {
    return {
      ok: false,
      error: "At least one role is required",
      code: "INVALID",
    };
  }

  const validRoles = await prisma.role.findMany({
    where: { id: { in: data.roleIds }, orgId },
    select: { id: true, key: true },
  });
  if (validRoles.length !== data.roleIds.length) {
    return {
      ok: false,
      error: "One or more roles not found or do not belong to this org",
      code: "INVALID",
    };
  }
  if (validRoles.some((r) => r.key === ROLE_KEYS.OWNER)) {
    return {
      ok: false,
      error: "Cannot assign the owner role",
      code: "INVALID",
    };
  }

  const bot = await prisma.$transaction(async (tx) => {
    const m = await tx.membership.create({
      data: {
        orgId,
        userId: null,
        botName: data.botName,
        workingDays: data.workingDays ?? [],
      },
      select: botSelect,
    });
    await Promise.all(
      data.roleIds.map((roleId) =>
        tx.memberRole.create({ data: { membershipId: m.id, roleId } }),
      ),
    );
    // Re-fetch to include the just-created memberRoles in the return value
    return tx.membership.findUniqueOrThrow({
      where: { id: m.id },
      select: botSelect,
    });
  });

  log.info("Bot created", {
    orgId,
    membershipId: bot.id,
    botName: data.botName,
  });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "bot.create",
    targetType: "Membership",
    targetId: bot.id,
    after: {
      botName: data.botName,
      roleIds: data.roleIds,
      workingDays: data.workingDays ?? [],
    },
  });
  return { ok: true, data: bot };
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteBot
// Deletes a bot membership. Refuses to delete real-user memberships.
// actorId — optional caller ID forwarded from the action layer for audit log.
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteBot(
  orgId: string,
  membershipId: string,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<null>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, orgId: true, userId: true, botName: true },
  });

  if (!membership || membership.orgId !== orgId) {
    return { ok: false, error: "Bot not found", code: "NOT_FOUND" };
  }
  if (membership.userId !== null) {
    return {
      ok: false,
      error: "Membership belongs to a real user — use deleteMembership instead",
      code: "INVALID",
    };
  }

  await prisma.$transaction([
    // Cancel any pending BOT_SLOT invites pointing to this membership
    prisma.invite.updateMany({
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
    }),
    prisma.membership.delete({ where: { id: membershipId } }),
  ]);
  log.info("Bot deleted", { orgId, membershipId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "bot.delete",
    targetType: "Membership",
    targetId: membershipId,
    before: { botName: membership.botName },
  });
  return { ok: true, data: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// transferToBot
// Converts an existing user membership into a bot. Clears userId, copies the
// user's name as botName, preserves all roles and working days.
// Requires MANAGE_MEMBERS — enforce this in the action/API layer.
// ─────────────────────────────────────────────────────────────────────────────

export async function memberToBot(
  orgId: string,
  data: MemberToBotInput,
  actorId?: string | null,
  actorEmail?: string | null,
): Promise<ServiceResult<BotMembership>> {
  const { membershipId, overrideName } = data;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });
  if (!org) return { ok: false, error: "Org not found", code: "NOT_FOUND" };

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) {
    return { ok: false, error: "Membership not found", code: "NOT_FOUND" };
  }
  if (membership.userId === null) {
    return {
      ok: false,
      error: "Membership is already a bot",
      code: "INVALID",
    };
  }
  if (membership.userId === org.ownerId) {
    return {
      ok: false,
      error: "Cannot convert the organization owner to a bot",
      code: "INVALID",
    };
  }

  const botName =
    overrideName ?? membership.user?.name ?? "Unnamed Placeholder";

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { userId: null, botName },
    select: botSelect,
  });

  log.info("Member converted to bot", { orgId, membershipId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    actorEmail: actorEmail ?? null,
    action: "membership.member_to_bot",
    targetType: "Membership",
    targetId: membershipId,
    before: { userId: membership.userId },
    after: { botName },
  });
  return { ok: true, data: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// transferToMember
// Replaces a bot with a real user account. Called when the invited user
// accepts their invite. The bot membership slot is converted in-place so all
// existing timetable/template assignments are preserved.
// ─────────────────────────────────────────────────────────────────────────────

export async function botToMember(
  orgId: string,
  data: BotToMemberInput,
  actorId?: string | null,
): Promise<ServiceResult<Prisma.MembershipGetPayload<Record<string, never>>>> {
  const { membershipId, userId } = data;
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, orgId: true, userId: true },
  });

  if (!membership || membership.orgId !== orgId) {
    return { ok: false, error: "Bot not found", code: "NOT_FOUND" };
  }
  if (membership.userId !== null) {
    log.warn("Conflict: bot membership slot already occupied by real user", {
      orgId,
      membershipId,
    });
    return {
      ok: false,
      error: "Membership slot is already occupied by a real user",
      code: "CONFLICT",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, error: "User not found", code: "NOT_FOUND" };
  }

  // Guard: user must not already have a membership in this org
  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
    select: { id: true },
  });
  if (existing) {
    log.warn("Conflict: user already has membership in org", {
      orgId,
      userId,
      membershipId,
    });
    return {
      ok: false,
      error: "User already has a membership in this org",
      code: "CONFLICT",
    };
  }

  try {
    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: { userId, botName: null },
    });
    log.info("Bot converted to member", {
      orgId,
      membershipId,
      userId,
    });
    recordAudit({
      orgId,
      actorId: actorId ?? null,
      action: "membership.bot_to_member",
      targetType: "Membership",
      targetId: membershipId,
      after: { userId },
    });
    return { ok: true, data: updated };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      log.warn("Conflict: DB unique violation on memberToBot", {
        orgId,
        membershipId,
        userId,
      });
      return {
        ok: false,
        error: "User already has a membership in this org",
        code: "CONFLICT",
      };
    }
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateBot
// Updates a bot's display name, working days, and role assignments in-place.
// ─────────────────────────────────────────────────────────────────────────────

export async function updateBot(
  orgId: string,
  membershipId: string,
  data: UpdateBotInput,
): Promise<ServiceResult<null>> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    select: { id: true, userId: true },
  });
  if (!membership)
    return { ok: false, error: "Bot not found", code: "NOT_FOUND" };
  if (membership.userId !== null)
    return {
      ok: false,
      error: "Membership belongs to a real user",
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
      where: { id: membershipId },
      data: { botName: data.botName, workingDays: data.workingDays },
    });
    await tx.memberRole.deleteMany({ where: { membershipId } });
    await Promise.all(
      data.roleIds.map((roleId) =>
        tx.memberRole.create({ data: { membershipId, roleId } }),
      ),
    );
  });

  log.info("Bot updated", { orgId, membershipId });
  return { ok: true, data: null };
}
