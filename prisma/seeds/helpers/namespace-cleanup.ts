import { PrismaClient } from "@prisma/client";
import { resolveSeedNamespace } from "@/lib/demo/seed-namespace";

export async function cleanupSeedNamespace(prisma: PrismaClient) {
  const namespace = resolveSeedNamespace();
  const orgSuffix = ` [${namespace}]`;
  const e2eOrgPrefix = `E2E [${namespace}] `;
  const namespacedEmailSuffix = `+${namespace}@example.test`;

  console.log(`  Seed namespace   : ${namespace}`);
  console.log("  Cleaning namespace-scoped seed data...");

  const orgsBefore = await prisma.organization.count();
  const namespaceOrgsBefore = await prisma.organization.count({
    where: { name: { endsWith: orgSuffix } },
  });
  const e2eOrgsBefore = await prisma.organization.count({
    where: {
      name: { startsWith: e2eOrgPrefix },
    },
  });
  const namespacedUsersBefore = await prisma.user.count({
    where: { email: { endsWith: namespacedEmailSuffix } },
  });

  console.log("  Before cleanup:", {
    totalOrgs: orgsBefore,
    namespaceOrgs: namespaceOrgsBefore,
    e2eOrgs: e2eOrgsBefore,
  });

  const orgDelete = await prisma.organization.deleteMany({
    where: {
      OR: [
        { name: { endsWith: orgSuffix } },
        { name: { startsWith: e2eOrgPrefix } },
      ],
    },
  });
  const userDelete = await prisma.user.deleteMany({
    where: { email: { endsWith: namespacedEmailSuffix } },
  });

  const orgsAfter = await prisma.organization.count();
  const namespaceOrgsAfter = await prisma.organization.count({
    where: { name: { endsWith: orgSuffix } },
  });
  const e2eOrgsAfter = await prisma.organization.count({
    where: {
      name: { startsWith: e2eOrgPrefix },
    },
  });
  const namespacedUsersAfter = await prisma.user.count({
    where: { email: { endsWith: namespacedEmailSuffix } },
  });

  console.log("Cleanup complete:", {
    totalOrgsBefore: orgsBefore,
    totalOrgsAfter: orgsAfter,
    namespaceOrgsBefore,
    namespaceOrgsAfter,
    e2eOrgsBefore,
    e2eOrgsAfter,
    namespacedUsersBefore,
    namespacedUsersAfter,
    orgsDeleted: orgDelete.count,
    usersDeleted: userDelete.count,
    namespaceCleared: namespaceOrgsAfter === 0,
    e2eCleared: e2eOrgsAfter === 0,
    usersCleared: namespacedUsersAfter === 0,
  });
}