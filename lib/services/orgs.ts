import { prisma } from "@/lib/prisma";
import { PermissionAction } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { CreateOrgInput } from "@/lib/validators/org";

// Permissions granted to the Owner role on every new org.
const ownerPermissions: PermissionAction[] = [
  PermissionAction.MANAGE_MEMBERS,
  PermissionAction.MANAGE_ROLES,
  PermissionAction.MANAGE_TIMETABLE,
  PermissionAction.MANAGE_TASKS,
  PermissionAction.MANAGE_SETTINGS,
];

// Permissions granted to the default Member role.
const memberPermissions: PermissionAction[] = [
  PermissionAction.VIEW_TIMETABLE,
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
        name: data.title,
        ownerId: userId,
        openTimeMin: data.openTimeMin ?? null,
        closeTimeMin: data.closeTimeMin ?? null,
      },
    });

    const [ownerRole, memberRole] = await Promise.all([
      tx.role.create({
        data: {
          orgId: org.id,
          name: "Owner",
          key: ROLE_KEYS.OWNER,
          isDeletable: false,
          isDefault: false,
        },
      }),
      tx.role.create({
        data: {
          orgId: org.id,
          name: "Member",
          key: ROLE_KEYS.DEFAULT_MEMBER,
          isDeletable: false,
          isDefault: true,
        },
      }),
    ]);

    await tx.permission.createMany({
      data: [
        ...ownerPermissions.map((action) => ({ roleId: ownerRole.id, action })),
        ...memberPermissions.map((action) => ({
          roleId: memberRole.id,
          action,
        })),
      ],
      skipDuplicates: true,
    });

    const membership = await tx.membership.create({
      data: { orgId: org.id, userId, workingDays: [] },
    });

    await tx.memberRole.create({
      data: { membershipId: membership.id, roleId: ownerRole.id },
    });

    return { org, ownerRole, memberRole, membership };
  });
}
