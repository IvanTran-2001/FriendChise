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
 * provided default role, if one is supplied.
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
    select: { userId: true },
  });
  const existingUserIds = new Set(
    existingMemberships.map((membership) => membership.userId),
  );

  const missingUsers = Object.values(users).filter(
    (user) => !existingUserIds.has(user.id),
  );
  if (missingUsers.length === 0) return [];

  const memberships = await prisma.membership.createManyAndReturn({
    data: missingUsers.map((user) => ({
      orgId,
      userId: user.id,
      workingDays: options.workingDays ?? [],
    })),
  });

  if (options.defaultRoleId) {
    await prisma.memberRole.createMany({
      data: memberships.map((membership) => ({
        membershipId: membership.id,
        roleId: options.defaultRoleId!,
      })),
      skipDuplicates: true,
    });
  }

  return memberships;
}