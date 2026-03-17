import { prisma } from "@/lib/prisma";
import { OrgPermission } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { CreateOrgInput } from "@/lib/validators/org";

// Permissions granted to the Owner role on every new org.
// Owners have full control over the org, its members, roles, and tasks.
const ownerPermissions: OrgPermission[] = [
  OrgPermission.ORG_MANAGE,
  OrgPermission.ROLE_MANAGE,
  OrgPermission.TASK_CREATE,
  OrgPermission.TASK_UPDATE,
  OrgPermission.TASK_DELETE,
  OrgPermission.TASK_ASSIGN,
  OrgPermission.TASKINSTANCE_COMPLETE,
];

// Permissions granted to the default Member role — enough to complete tasks,
// but not to manage the org, create tasks, or assign others.
const workerPermissions: OrgPermission[] = [
  OrgPermission.TASKINSTANCE_COMPLETE,
];

/**
 * Creates a new org and bootstraps it inside a single transaction:
 *   1. Creates the Organization record
 *   2. Creates Owner and Member roles with their respective permissions
 *   3. Creates a Membership linking the creator to the Owner role
 *
 * All steps are atomic — if any step fails, nothing is persisted.
 */
export async function createOrg(userId: string, data: CreateOrgInput) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        title: data.title,
        ownerUserId: userId,
        openTimeMin: data.openTimeMin ?? null,
        closeTimeMin: data.closeTimeMin ?? null,
      },
    });

    const [ownerRole, memberRole] = await Promise.all([
      tx.role.create({
        data: { orgId: org.id, title: "Owner", key: ROLE_KEYS.OWNER },
      }),
      tx.role.create({
        data: { orgId: org.id, title: "Member", key: ROLE_KEYS.DEFAULT_MEMBER },
      }),
    ]);

    await tx.rolePermission.createMany({
      data: [
        ...ownerPermissions.map((permission) => ({
          roleId: ownerRole.id,
          permission,
        })),
        ...workerPermissions.map((permission) => ({
          roleId: memberRole.id,
          permission,
        })),
      ],
      skipDuplicates: true,
    });

    const membership = await tx.membership.create({
      data: { orgId: org.id, userId, roleId: ownerRole.id },
    });

    return { org, ownerRole, memberRole, membership };
  });
}
