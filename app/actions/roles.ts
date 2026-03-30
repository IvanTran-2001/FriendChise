"use server";

/**
 * Server actions for role management.
 *
 * All mutations require the `MANAGE_ROLES` permission. Actions delegate to the
 * roles service and call `revalidatePath` so the roles page reflects the change
 * without a full page reload.
 */
import { revalidatePath } from "next/cache";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionAction } from "@/lib/authz";
import { deleteRole } from "@/lib/services/roles";

/**
 * Deletes a role from an org.
 *
 * Auth: caller must hold `MANAGE_ROLES` in this org.
 * Delegates to `deleteRole` which blocks deletion of system roles.
 */
export async function deleteRoleAction(
  orgId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_ROLES,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const result = await deleteRole(orgId, roleId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/roles`);
  return { ok: true };
}
