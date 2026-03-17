import { prisma } from "@/lib/prisma";
import { OrgPermission } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/rbac";
import type { CreateOrgInput } from "@/lib/validators/org";

const ownerPermissions: OrgPermission[] = [
  OrgPermission.ORG_MANAGE,
  OrgPermission.ROLE_MANAGE,
  OrgPermission.TASK_CREATE,
  OrgPermission.TASK_UPDATE,
  OrgPermission.TASK_DELETE,
  OrgPermission.TASK_ASSIGN,
  OrgPermission.TASKINSTANCE_COMPLETE,
];

const workerPermissions: OrgPermission[] = [
  OrgPermission.TASKINSTANCE_COMPLETE,
];

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
        ...ownerPermissions.map((permission) => ({ roleId: ownerRole.id, permission })),
        ...workerPermissions.map((permission) => ({ roleId: memberRole.id, permission })),
      ],
      skipDuplicates: true,
    });

    const membership = await tx.membership.create({
      data: { orgId: org.id, userId, roleId: ownerRole.id },
    });

    return { org, ownerRole, memberRole, membership };
  });
}
