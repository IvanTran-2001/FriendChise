/**
 * Roles service — all database reads and writes related to org roles.
 *
 * Roles define what a member can do inside an org. Two system roles are seeded
 * automatically when an org is created (Owner, Default Member) and cannot be
 * deleted. Custom roles can be created freely and removed here.
 */
import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";
import type { ServiceResult } from "./types";

/**
 * Shape returned by getRoles — includes the role's permission list so the UI
 * can display which actions the role grants without a second query.
 */
export type RoleWithPermissions = {
  id: string;
  name: string;
  color: string | null;
  key: string;
  isDeletable: boolean;
  isDefault: boolean;
  permissions: { action: PermissionAction }[];
};

/**
 * Returns all roles for an org, ordered alphabetically by name.
 * Each role includes its granted permissions (PermissionAction values).
 */
export async function getRoles(orgId: string): Promise<RoleWithPermissions[]> {
  return prisma.role.findMany({
    where: { orgId },
    select: {
      id: true,
      name: true,
      color: true,
      key: true,
      isDeletable: true,
      isDefault: true,
      permissions: { select: { action: true } },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Deletes a role by ID, scoped to the org.
 *
 * Guards:
 * - Returns NOT_FOUND if the role doesn't exist in this org.
 * - Returns INVALID if `isDeletable` is false (Owner, Default Member).
 *
 * Cascade: Permission and MemberRole rows are deleted automatically by the DB.
 */
export async function deleteRole(
  orgId: string,
  roleId: string,
): Promise<ServiceResult<null>> {
  const role = await prisma.role.findFirst({ where: { id: roleId, orgId } });
  if (!role) return { ok: false, error: "Role not found.", code: "NOT_FOUND" };
  if (!role.isDeletable)
    return { ok: false, error: "This role cannot be deleted.", code: "INVALID" };

  await prisma.role.delete({ where: { id: roleId } });
  return { ok: true, data: null };
}
