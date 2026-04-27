"use server";

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  deleteMembership,
  updateMembership,
  setMembershipStatus,
} from "@/lib/services/memberships";
import { createMemberInvite } from "@/lib/services/invites";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { sendMemberInviteSchema } from "@/lib/validators/membership";
import { normalizeEmail } from "@/lib/utils";

export async function sendMemberInviteAction(
  orgId: string,
  data: { email: string; roleIds: string[]; workingDays: string[] },
): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const session = await auth();
  const invitedById = session?.user?.id ?? null;

  const parsed = sendMemberInviteSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      issue.path[0] === "email"
        ? "email"
        : issue.path[0] === "roleIds"
          ? "roles"
          : undefined;
    return { ok: false, error: issue.message, field };
  }

  const { email: rawEmail, workingDays } = parsed.data;
  let { roleIds } = parsed.data;
  const email = normalizeEmail(rawEmail);

  // If no roles selected, fall back to the org's default member role.
  if (roleIds.length === 0) {
    const defaultRole = await prisma.role.findFirst({
      where: { orgId, isDefault: true },
      select: { id: true },
    });
    if (defaultRole) roleIds = [defaultRole.id];
  }

  const recipient = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!recipient)
    return {
      ok: false,
      error: "No user found with that email address",
      field: "email",
    };

  const result = await createMemberInvite(
    orgId,
    invitedById,
    recipient.id,
    roleIds,
    workingDays,
  );
  if (!result.ok) {
    const field =
      result.code === "CONFLICT"
        ? "email"
        : result.code === "INVALID"
          ? "roles"
          : undefined;
    return { ok: false, error: result.error, field };
  }

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

/**
 * Removes a member from the org. Guards against removing the org owner.
 * Revalidates the memberships list on success.
 */
export async function deleteMembershipAction(
  orgId: string,
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await deleteMembership(orgId, membershipId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  return { ok: true };
}

/**
 * Updates a member's working days and role assignments.
 * Revalidates both the list and the detail page on success.
 */
export async function updateMembershipAction(
  orgId: string,
  membershipId: string,
  data: { workingDays: string[]; roleIds: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateMembership(orgId, membershipId, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  revalidatePath(`/orgs/${orgId}/memberships/${membershipId}`);
  return { ok: true };
}

/**
 * Toggles a member's status between ACTIVE and RESTRICTED.
 */
export async function setMemberStatusAction(
  orgId: string,
  membershipId: string,
  status: "ACTIVE" | "RESTRICTED",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await setMembershipStatus(orgId, membershipId, status);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  revalidatePath(`/orgs/${orgId}/memberships/${membershipId}`);
  return { ok: true };
}
