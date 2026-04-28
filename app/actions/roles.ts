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
import { deleteRole, createRole, updateRole } from "@/lib/services/roles";
import { roleFormSchema } from "@/lib/validators/role";

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

  const result = await deleteRole(orgId, roleId, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/roles`);
  return { ok: true };
}

/**
 * Creates a new custom role for an org.
 *
 * Auth: caller must hold `MANAGE_ROLES` in this org.
 * Validates input with `roleFormSchema`, then delegates to `createRole`.
 * `taskIds` controls which tasks the role is eligible to perform.
 */
export async function createRoleAction(
  orgId: string,
  data: {
    name: string;
    color?: string;
    permissions: PermissionAction[];
    taskIds: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_ROLES,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const parsed = roleFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await createRole(orgId, parsed.data, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/roles`);
  return { ok: true };
}

/**
 * Updates an existing role's name, color, permissions, and task eligibility.
 *
 * Auth: caller must hold `MANAGE_ROLES` in this org.
 * Blocks edits to the Owner role.
 * Permissions and task eligibility are replaced wholesale on every save.
 */
export async function updateRoleAction(
  orgId: string,
  roleId: string,
  data: {
    name: string;
    color?: string;
    permissions: PermissionAction[];
    taskIds: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await requireOrgPermissionAction(
    orgId,
    PermissionAction.MANAGE_ROLES,
  );
  if (!authz.ok) return { ok: false, error: "Unauthorized." };

  const parsed = roleFormSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await updateRole(orgId, roleId, parsed.data, authz.userId, authz.userEmail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/orgs/${orgId}/settings/roles`);
  return { ok: true };
}
