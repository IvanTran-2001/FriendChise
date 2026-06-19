import type { PrismaClient } from "@prisma/client";
import type { Users } from "./users";

type ConnectSeedUsersOptions = {
  workingDays?: string[];
  defaultRoleId?: string;
};

/**
 * Ensures every namespaced seed user is a member of the given org.
 *
 * Existing memberships are preserved. Any missing users are added with the
 * provided default role, if one is supplied. This function is idempotent:
 * role assignment will execute even on reruns when no new memberships are created.
 */
export async function connectSeedUsersToOrg(
  prisma: PrismaClient,
  orgId: string,
  users: Users,
  options: ConnectSeedUsersOptions = {},
) {
  const allUserIds = Object.values(users).map((user) => user.id);
  const existingMemberships = await prisma.membership.findMany({
    where: { orgId, userId: { in: allUserIds } },
    select: { userId: true, id: true },
  });
  const existingUserIds = new Set(
    existingMemberships.map((membership) => membership.userId),
  );

  const missingUsers = Object.values(users).filter(
    (user) => !existingUserIds.has(user.id),
  );

  let newMemberships: Array<{ id: string }> = [];
  if (missingUsers.length > 0) {
    newMemberships = await prisma.membership.createManyAndReturn({
      data: missingUsers.map((user) => ({
        orgId,
        userId: user.id,
        workingDays: options.workingDays ?? [],
      })),
    });
  }

  if (options.defaultRoleId) {
    const allMemberships = await prisma.membership.findMany({
      where: { orgId, userId: { in: allUserIds } },
      select: { id: true },
    });

    await prisma.memberRole.createMany({
      data: allMemberships.map((membership) => ({
        membershipId: membership.id,
        roleId: options.defaultRoleId!,
      })),
      skipDuplicates: true,
    });
  }

  return newMemberships;
}