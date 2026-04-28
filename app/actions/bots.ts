"use server";

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  createBot,
  deleteBot,
  memberToBot,
  updateBot,
} from "@/lib/services/bots";
import { createMemberInvite } from "@/lib/services/invites";
import {
  createBotSchema,
  memberToBotSchema,
  updateBotSchema,
  inviteBotSlotSchema,
} from "@/lib/validators/bot";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { normalizeEmail } from "@/lib/utils";

export async function createBotAction(
  orgId: string,
  data: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = createBotSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  let { roleIds } = parsed.data;

  // Fall back to the org's default role when none is selected
  if (roleIds.length === 0) {
    const defaultRole = await prisma.role.findFirst({
      where: { orgId, isDefault: true },
      select: { id: true },
    });
    if (!defaultRole)
      return { ok: false, error: "No default role found for this org" };
    roleIds = [defaultRole.id];
  }

  const result = await createBot(
    orgId,
    { ...parsed.data, roleIds },
    authz.userId,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

export async function deleteBotAction(
  orgId: string,
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await deleteBot(orgId, membershipId, authz.userId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

export async function memberToBotAction(
  orgId: string,
  data: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = memberToBotSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const result = await memberToBot(orgId, parsed.data, authz.userId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

/**
 * Sends an invite to fill a bot slot. When the user accepts, they are slotted
 * into the existing bot membership (preserving timetable assignments) instead
 * of creating a new membership.
 */
export async function inviteBotSlotAction(
  orgId: string,
  membershipId: string,
  data: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = inviteBotSlotSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const email = normalizeEmail(parsed.data.email);

  // Verify the membership is still a bot slot
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId, orgId },
    select: {
      id: true,
      userId: true,
      memberRoles: { select: { roleId: true } },
      workingDays: true,
    },
  });
  if (!membership) return { ok: false, error: "Membership not found" };
  if (membership.userId !== null)
    return { ok: false, error: "This slot already belongs to a real user" };

  // Look up the user by email
  const recipient = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!recipient)
    return { ok: false, error: "No account found with that email address" };

  const session = await auth();
  const invitedById = session?.user?.id ?? null;

  const roleIds = membership.memberRoles.map((mr) => mr.roleId);

  const result = await createMemberInvite(
    orgId,
    invitedById,
    recipient.id,
    roleIds,
    membership.workingDays,
    membershipId,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

/**
 * Updates a bot's display name, working days, and role assignments.
 */
export async function updateBotAction(
  orgId: string,
  membershipId: string,
  data: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const parsed = updateBotSchema.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const result = await updateBot(orgId, membershipId, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  revalidatePath(`/orgs/${orgId}/memberships/${membershipId}`);
  return { ok: true };
}
