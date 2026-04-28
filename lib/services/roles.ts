/**
 * Roles service — all database reads and writes related to org roles.
 *
 * Roles define what a member can do inside an org. Two system roles are seeded
 * automatically when an org is created (Owner, Default Member) and cannot be
 * deleted. Custom roles can be created freely and removed here.
 */
import { log } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import { recordAudit } from "@/lib/services/audit-log";
import type { RoleFormInput } from "@/lib/validators/role";
import type { ServiceResult } from "./types";

/**
 * Shape returned by getRoles — includes the role's permission list so the UI
 * can display which actions the role grants without a second query.
 */
export type RoleWithPermissions = {
  id: string;
  name: string;
  color: string;
  key: string;
  isDeletable: boolean;
  isDefault: boolean;
  permissions: { action: PermissionAction }[];
  eligibleFor: { task: { id: string; name: string; color: string } }[];
};

/**
 * Returns all roles for an org, ordered alphabetically by name.
 * Each role includes its granted permissions (PermissionAction values).
 */
export async function getRoles(orgId: string): Promise<RoleWithPermissions[]> {
  return prisma.role.findMany({
    where: { orgId },
    select: roleSelect,
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
  actorId?: string | null,
): Promise<ServiceResult<null>> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, orgId },
    include: { permissions: { select: { action: true } } },
  });
  if (!role) return { ok: false, error: "Role not found.", code: "NOT_FOUND" };
  if (!role.isDeletable)
    return {
      ok: false,
      error: "This role cannot be deleted.",
      code: "INVALID",
    };

  await prisma.role.delete({ where: { id: roleId } });
  log.info("Role deleted", { orgId, roleId });
  recordAudit({
    orgId,
    actorId: actorId ?? null,
    action: "role.delete",
    targetType: "Role",
    targetId: roleId,
    before: {
      name: role.name,
      color: role.color,
      permissions: role.permissions.map((p) => p.action),
    },
  });
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
  eligibleFor: {
    select: { task: { select: { id: true, name: true, color: true } } },
  },
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
 *
 * Security: task IDs are resolved against `Task` scoped to `orgId` inside the transaction.
 * Any ID that doesn't belong to this org causes the whole transaction to abort and returns
 * an INVALID error, preventing cross-tenant TaskEligibility rows from being written.
 *
 * Duplicates in `data.taskIds` and `data.permissions` are silently deduplicated before
 * insertion to avoid unique-constraint failures.
 *
 * Returns INVALID if any supplied task ID is not found in this org.
 */
export async function createRole(
  orgId: string,
  data: RoleFormInput,
  actorId?: string | null,
): Promise<ServiceResult<RoleWithPermissions>> {
  const role = await prisma.$transaction(async (tx) => {
    const taskIds = [...new Set(data.taskIds)];
    const permissionActions = [...new Set(data.permissions)];
    if (taskIds.length > 0) {
      const orgTasks = await tx.task.findMany({
        where: { orgId, id: { in: taskIds } },
        select: { id: true },
      });
      if (orgTasks.length !== taskIds.length) return null;
    }

    const created = await tx.role.create({
      data: {
        orgId,
        name: data.name,
        color: data.color ?? "#808080",
        key: crypto.randomUUID(),
        isDeletable: true,
        isDefault: false,
      },
    });

    if (permissionActions.length > 0) {
      await tx.permission.createMany({
        data: permissionActions.map((action) => ({
          roleId: created.id,
          action,
        })),
      });
    }

    if (taskIds.length > 0) {
      await tx.taskEligibility.createMany({
        data: taskIds.map((taskId) => ({ roleId: created.id, taskId })),
      });
    }

    const finalRole = await tx.role.findUniqueOrThrow({
      where: { id: created.id },
      select: roleSelect,
    });

    await recordAudit(
      {
        orgId,
        actorId: actorId ?? null,
        action: "role.create",
        targetType: "Role",
        targetId: created.id,
        after: {
          name: finalRole.name,
          color: finalRole.color,
          permissions: finalRole.permissions.map((p) => p.action),
        },
      },
      tx,
    );

    return finalRole;
  });

  if (!role) {
    return {
      ok: false,
      error: "One or more tasks are invalid for this organization.",
      code: "INVALID",
    };
  }

  log.info("Role created", { orgId, roleId: role.id });
  return { ok: true, data: role };
}

/**
 * Updates a role's name, color, permission set, and task eligibility.
 * Both permissions and task eligibility are replaced wholesale (delete-then-insert)
 * so the caller provides the full desired set each time.
 *
 * Security: task IDs are resolved against `Task` scoped to `orgId` inside the transaction.
 * Any ID not belonging to this org aborts the transaction and returns INVALID, preventing
 * cross-tenant TaskEligibility rows from being written.
 *
 * Duplicates in `data.taskIds` and `data.permissions` are silently deduplicated before
 * insertion to avoid unique-constraint failures.
 *
 * Guards:
 * - Returns NOT_FOUND if the role doesn't exist in this org.
 * - Returns INVALID if the role is the system Owner role.
 * - Returns INVALID if any supplied task ID is not found in this org.
 */
export async function updateRole(
  orgId: string,
  roleId: string,
  data: RoleFormInput,
  actorId?: string | null,
): Promise<ServiceResult<RoleWithPermissions>> {
  // Guard before entering the transaction so the caller can trust that
  // $transaction is never called for invalid inputs (also matches test expectations).
  const preCheck = await prisma.role.findFirst({
    where: { id: roleId, orgId },
    select: { key: true },
  });
  if (!preCheck)
    return { ok: false, error: "Role not found.", code: "NOT_FOUND" };
  if (preCheck.key === ROLE_KEYS.OWNER) {
    return {
      ok: false,
      error: "The Owner role cannot be edited.",
      code: "INVALID",
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Fetch the full role inside the transaction for a consistent snapshot
    const existing = await tx.role.findFirst({
      where: { id: roleId, orgId },
      include: { permissions: { select: { action: true } } },
    });
    if (!existing) return { error: "NOT_FOUND" as const };

    const taskIds = [...new Set(data.taskIds)];
    const permissionActions = [...new Set(data.permissions)];
    if (taskIds.length > 0) {
      const orgTasks = await tx.task.findMany({
        where: { orgId, id: { in: taskIds } },
        select: { id: true },
      });
      if (orgTasks.length !== taskIds.length)
        return { error: "INVALID_TASKS" as const };
    }

    await tx.role.update({
      where: { id: roleId },
      data: { name: data.name, color: data.color ?? "#808080" },
    });
    await tx.permission.deleteMany({ where: { roleId } });
    if (permissionActions.length > 0) {
      await tx.permission.createMany({
        data: permissionActions.map((action) => ({ roleId, action })),
      });
    }

    await tx.taskEligibility.deleteMany({ where: { roleId } });
    if (taskIds.length > 0) {
      await tx.taskEligibility.createMany({
        data: taskIds.map((taskId) => ({ roleId, taskId })),
      });
    }

    const finalRole = await tx.role.findUniqueOrThrow({
      where: { id: roleId },
      select: roleSelect,
    });

    await recordAudit(
      {
        orgId,
        actorId: actorId ?? null,
        action: "role.update",
        targetType: "Role",
        targetId: roleId,
        before: {
          name: existing.name,
          color: existing.color,
          permissions: existing.permissions.map((p) => p.action),
        },
        after: {
          name: finalRole.name,
          color: finalRole.color,
          permissions: finalRole.permissions.map((p) => p.action),
        },
      },
      tx,
    );

    return { error: null, data: finalRole };
  });

  if (updated.error === "NOT_FOUND") {
    return { ok: false, error: "Role not found.", code: "NOT_FOUND" };
  }
  if (updated.error === "INVALID_TASKS") {
    return {
      ok: false,
      error: "One or more tasks are invalid for this organization.",
      code: "INVALID",
    };
  }

  log.info("Role updated", { orgId, roleId });
  return { ok: true, data: updated.data };
}
