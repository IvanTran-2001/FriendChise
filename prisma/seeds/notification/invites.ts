import { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/auth/rbac";
import { seedDisplayName, seedEmail } from "@/lib/demo/seed-namespace";
import { createMemberInvite } from "@/lib/services/invites";
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
  const inviteeEmail = seedEmail("invitee");
  const invitee = await prisma.user.upsert({
    where: { email: inviteeEmail },
    update: {
      name: seedDisplayName("Invitee"),
      image: "https://i.pravatar.cc/150?img=23",
    },
    create: {
      email: inviteeEmail,
      name: seedDisplayName("Invitee"),
      image: "https://i.pravatar.cc/150?img=23",
    },
  });

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

  for (const [index, orgName] of targetOrgNames.entries()) {
    const org = orgByName.get(orgName);
    if (!org) {
      throw new Error(`Test org not found: ${orgName}`);
    }

    const roleId = roleIdByOrgId.get(org.id);
    if (!roleId) {
      throw new Error(`Default role not found for test org ${org.name}.`);
    }

    const result = await createMemberInvite(
      org.id,
      users.jordan.id,
      invitee.id,
      [roleId],
      index % 2 === 0 ? ["mon", "wed", "fri"] : ["tue", "thu"],
      { actorEmail: users.jordan.email },
    );

    if (!result.ok) {
      throw new Error(result.error);
    }
  }
}

export function registerInviteSeeds(plan: SeedPlan) {
  // Register the invite seed to run after org creation so the org IDs and role IDs already exist.
  plan.afterOrg.push(seedInvites);
}