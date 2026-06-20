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
 * provided default role, if one is supplied. Role assignment is idempotent,
 * so rerunning seeds keeps memberships and roles aligned.
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
  const memberships =
    missingUsers.length === 0
      ? []
      : await prisma.membership.createManyAndReturn({
          data: missingUsers.map((user) => ({
            orgId,
            userId: user.id,
            workingDays: options.workingDays ?? [],
          })),
        });

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

  return memberships;
}