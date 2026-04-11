"use server";

/**
 * Server Actions for membership management.
 */

import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import {
  deleteMembership,
  updateMembership,
  setMembershipStatus,
} from "@/lib/services/memberships";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ROLE_KEYS } from "@/lib/rbac";

/**
 * Adds a new member to an org by email, with working days and one or more roles.
 * Used by the create-membership form via useTransition.
 */
export async function createMembershipAction(
  orgId: string,
  data: { email: string; roleIds: string[]; workingDays: string[] },
): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const email = data.email.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required", field: "email" };
  if (data.roleIds.length === 0)
    return {
      ok: false,
      error: "At least one role is required",
      field: "roles",
    };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user)
    return {
      ok: false,
      error: "No user found with that email address",
      field: "email",
    };

  const validRoles = await prisma.role.findMany({
    where: { id: { in: data.roleIds }, orgId },
    select: { id: true, key: true },
  });
  if (validRoles.length !== data.roleIds.length)
    return { ok: false, error: "One or more roles not found", field: "roles" };
  if (validRoles.some((r) => r.key === ROLE_KEYS.OWNER))
    return { ok: false, error: "Cannot assign the owner role", field: "roles" };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId } },
      });
      if (existing) throw new Error("CONFLICT");

      const m = await tx.membership.create({
        data: { orgId, userId: user.id, workingDays: data.workingDays },
      });
      await Promise.all(
        data.roleIds.map((roleId) =>
          tx.memberRole.create({ data: { membershipId: m.id, roleId } }),
        ),
      );
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CONFLICT")
      return {
        ok: false,
        error: "This user is already a member",
        field: "email",
      };
    throw e;
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
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await deleteMembership(orgId, userId);
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
  userId: string,
  data: { workingDays: string[]; roleIds: string[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await updateMembership(orgId, userId, data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  revalidatePath(`/orgs/${orgId}/memberships/${userId}`);
  return { ok: true };
}

/**
 * Toggles a member's status between ACTIVE and RESTRICTED.
 */
export async function setMemberStatusAction(
  orgId: string,
  userId: string,
  status: "ACTIVE" | "RESTRICTED",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized" };

  const result = await setMembershipStatus(orgId, userId, status);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/memberships`);
  revalidatePath(`/orgs/${orgId}/memberships/${userId}`);
  return { ok: true };
}
