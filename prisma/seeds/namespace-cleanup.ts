import { PrismaClient } from "@prisma/client";
import { resolveSeedNamespace } from "@/lib/seed-namespace";

export async function cleanupSeedNamespace(prisma: PrismaClient) {
  const namespace = resolveSeedNamespace();
  const orgSuffix = ` [${namespace}]`;
  const e2eOrgPrefix = `E2E [${namespace}] `;
  const legacyE2eOrgPrefix = "E2E ";

  console.log(`  Seed namespace   : ${namespace}`);
  console.log("  Cleaning namespace-scoped seed data...");

  const orgsBefore = await prisma.organization.count();
  const namespaceOrgsBefore = await prisma.organization.count({
    where: { name: { endsWith: orgSuffix } },
  });
  const e2eOrgsBefore = await prisma.organization.count({
    where: {
      OR: [
        { name: { startsWith: e2eOrgPrefix } },
        { name: { startsWith: legacyE2eOrgPrefix } },
      ],
    },
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
        { name: { startsWith: legacyE2eOrgPrefix } },
      ],
    },
  });

  const orgsAfter = await prisma.organization.count();
  const namespaceOrgsAfter = await prisma.organization.count({
    where: { name: { endsWith: orgSuffix } },
  });
  const e2eOrgsAfter = await prisma.organization.count({
    where: {
      OR: [
        { name: { startsWith: e2eOrgPrefix } },
        { name: { startsWith: legacyE2eOrgPrefix } },
      ],
    },
  });

  console.log("Cleanup complete:", {
    totalOrgsBefore: orgsBefore,
    totalOrgsAfter: orgsAfter,
    namespaceOrgsBefore,
    namespaceOrgsAfter,
    e2eOrgsBefore,
    e2eOrgsAfter,
    orgsDeleted: orgDelete.count,
    namespaceCleared: namespaceOrgsAfter === 0,
    e2eCleared: e2eOrgsAfter === 0,
  });
}
