import { PrismaClient, InviteType } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/auth/rbac";
import { seedDisplayName } from "@/lib/demo/seed-namespace";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../shared/users";
import { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";
import { EMPTY_ORG_BASE_NAMES } from "../dummies/empty-orgs";

export async function seedInvites(
  prisma: PrismaClient,
  users: Users,
  _donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const targetOrgNames = EMPTY_ORG_BASE_NAMES.map((baseName) => seedDisplayName(baseName));

  const seededOrgs = await prisma.organization.findMany({
    where: {
      ownerId: users.jordan.id,
      name: { in: targetOrgNames },
    },
    select: { id: true, name: true },
  });
  if (seededOrgs.length !== EMPTY_ORG_BASE_NAMES.length) {
    throw new Error(`Expected ${EMPTY_ORG_BASE_NAMES.length} test orgs, found ${seededOrgs.length}.`);
  }
  const orgByName = new Map(seededOrgs.map((org) => [org.name, org]));

  const defaultMemberRoles = await prisma.role.findMany({
    where: {
      orgId: { in: seededOrgs.map((org) => org.id) },
      key: ROLE_KEYS.DEFAULT_MEMBER,
    },
    select: { id: true, orgId: true },
  });
  const roleIdByOrgId = new Map(defaultMemberRoles.map((role) => [role.orgId, role.id]));

  const inviteRows = targetOrgNames.map((orgName, index) => {
    const org = orgByName.get(orgName);
    if (!org) {
      throw new Error(`Test org not found: ${orgName}`);
    }

    const roleId = roleIdByOrgId.get(org.id);
    if (!roleId) {
      throw new Error(`Default role not found for test org ${org.name}.`);
    }

    return {
      orgId: org.id,
      invitedById: users.jordan.id,
      recipientId: users.owner.id,
      type: InviteType.MEMBER,
      orgName: org.name,
      inviterName: users.jordan.name ?? "Jordan",
      metadata: {
        roleIds: [roleId],
        workingDays: index % 2 === 0 ? ["mon", "wed", "fri"] : ["tue", "thu"],
      },
    };
  });

  await prisma.invite.createMany({ data: inviteRows });
}

export function registerInviteSeeds(plan: SeedPlan) {
  // Register the invite seed to run after org creation so the org IDs and role IDs already exist.
  plan.afterOrg.push(seedInvites);
}