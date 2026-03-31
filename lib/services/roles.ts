/**
 * Roles service — all database reads and writes related to org roles.
 *
 * Roles define what a member can do inside an org. Two system roles are seeded
 * automatically when an org is created (Owner, Default Member) and cannot be
 * deleted. Custom roles can be created freely and removed here.
 */
import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { RoleFormInput } from "@/lib/validators/role";
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
  eligibleFor: { task: { id: string; name: string; color: string | null } }[];
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
      eligibleFor: { select: { task: { select: { id: true, name: true, color: true } } } },
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
    return {
      ok: false,
      error: "This role cannot be deleted.",
      code: "INVALID",
    };

  await prisma.role.delete({ where: { id: roleId } });
  return { ok: true, data: null };
}

// ─── Shared select shape ─────────────────────────────────────────────────────

const roleSelect = {
  id: true,
  name: true,
  color: true,
  key: true,
  isDeletable: true,
  isDefault: true,
  permissions: { select: { action: true } },
  eligibleFor: { select: { task: { select: { id: true, name: true, color: true } } } },
} as const;

/**
 * Returns a single role by ID, scoped to the org.
 * Returns null if not found.
 */
export async function getRoleById(
  orgId: string,
  roleId: string,
): Promise<RoleWithPermissions | null> {
  return prisma.role.findFirst({
    where: { id: roleId, orgId },
    select: roleSelect,
  });
}

/**
 * Creates a new custom role for an org with the supplied permissions and task eligibility.
 * All steps are atomic — role, permissions, and TaskEligibility rows are created together.
 */
export async function createRole(
  orgId: string,
  data: RoleFormInput,
): Promise<ServiceResult<RoleWithPermissions>> {
  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        orgId,
        name: data.name,
        color: data.color ?? null,
        key: crypto.randomUUID(),
        isDeletable: true,
        isDefault: false,
      },
    });

    if (data.permissions.length > 0) {
      await tx.permission.createMany({
        data: data.permissions.map((action) => ({
          roleId: created.id,
          action,
        })),
      });
    }

    if (data.taskIds.length > 0) {
      await tx.taskEligibility.createMany({
        data: data.taskIds.map((taskId) => ({ roleId: created.id, taskId })),
      });
    }

    return tx.role.findUniqueOrThrow({
      where: { id: created.id },
      select: roleSelect,
    });
  });

  return { ok: true, data: role };
}

/**
 * Updates a role's name, color, permission set, and task eligibility.
 * Both permissions and task eligibility are replaced wholesale (delete-then-insert)
 * so the caller provides the full desired set each time.
 *
 * Guards:
 * - Returns NOT_FOUND if the role doesn't exist in this org.
 * - Returns INVALID if the role is the system Owner role.
 */
export async function updateRole(
  orgId: string,
  roleId: string,
  data: RoleFormInput,
): Promise<ServiceResult<RoleWithPermissions>> {
  const existing = await prisma.role.findFirst({
    where: { id: roleId, orgId },
  });
  if (!existing)
    return { ok: false, error: "Role not found.", code: "NOT_FOUND" };
  if (existing.key === ROLE_KEYS.OWNER)
    return {
      ok: false,
      error: "The Owner role cannot be edited.",
      code: "INVALID",
    };

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: roleId },
      data: { name: data.name, color: data.color ?? null },
    });
    await tx.permission.deleteMany({ where: { roleId } });
    if (data.permissions.length > 0) {
      await tx.permission.createMany({
        data: data.permissions.map((action) => ({ roleId, action })),
      });
    }

    await tx.taskEligibility.deleteMany({ where: { roleId } });
    if (data.taskIds.length > 0) {
      await tx.taskEligibility.createMany({
        data: data.taskIds.map((taskId) => ({ roleId, taskId })),
      });
    }
  });

  const updated = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    select: roleSelect,
  });

  return { ok: true, data: updated };
}
