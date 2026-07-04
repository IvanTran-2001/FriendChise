import type { PrismaClient } from "@prisma/client";
import { seedRandomAuditLogs } from "./audit-logs";
import { seedConversionData } from "./orgs/walker's doughnut/walkers-doughnuts";
import { registerEmptyOrgSeeds } from "./dummies/empty-orgs";
import { registerInviteSeeds } from "./notification/invites";
import { registerNotificationSeeds } from "./notification/notifications";
import { registerDonutShopASeeds, seedDonutShopA } from "./orgs/donut-shop-a/donut-shop-a";
import { registerSeedUsers, type Users } from "./users";

export type SeedContext = {
  users: Users;
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>;
};

export type UserSeeder = (prisma: PrismaClient) => Promise<Users>;
export type OrgSeeder = (
  prisma: PrismaClient,
  users: Users,
) => Promise<Awaited<ReturnType<typeof seedDonutShopA>>>;
export type AfterOrgSeeder = (
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) => Promise<void>;

export type SeedPlan = {
  users: UserSeeder[];
  orgs: OrgSeeder[];
  afterOrg: AfterOrgSeeder[];
};

export function createSeedPlan(): SeedPlan {
  return {
    users: [],
    orgs: [],
    afterOrg: [],
  };
}

export function registerSeedModules(plan: SeedPlan) {
  // Register seed modules in dependency order so users and orgs exist before any related activity seeds run.
  registerSeedUsers(plan);
  registerDonutShopASeeds(plan);
  // Conversion data depends on the seeded org, so it runs after the org seed finishes.
  plan.afterOrg.push(async (prisma, _users, donutShopA) => {
    await seedConversionData(prisma, donutShopA.org.id);
  });
  plan.afterOrg.push(async (prisma, users, donutShopA) => {
    await seedRandomAuditLogs(prisma, donutShopA.org.id, users);
  });
  registerEmptyOrgSeeds(plan);
  registerInviteSeeds(plan);
  registerNotificationSeeds(plan);
}

export function buildSeedPlan(): SeedPlan {
  const plan = createSeedPlan();
  registerSeedModules(plan);
  return plan;
}

async function runUserSeeders(plan: SeedPlan, prisma: PrismaClient) {
  let users: Users | null = null;
  for (const seedUsers of plan.users) {
    users = await seedUsers(prisma);
  }
  if (!users) {
    throw new Error("No user seeders registered.");
  }
  return users;
}

async function runOrgSeeders(
  plan: SeedPlan,
  prisma: PrismaClient,
  users: Users,
) {
  let donutShopA: Awaited<ReturnType<typeof seedDonutShopA>> | null = null;
  for (const seedOrg of plan.orgs) {
    donutShopA = await seedOrg(prisma, users);
  }
  if (!donutShopA) {
    throw new Error("No org seeders registered.");
  }
  return donutShopA;
}

async function runAfterOrgSeeders(
  plan: SeedPlan,
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  for (const seedAfterOrg of plan.afterOrg) {
    await seedAfterOrg(prisma, users, donutShopA);
  }
}

export async function runSeedPlan(prisma: PrismaClient) {
  const plan = buildSeedPlan();
  const users = await runUserSeeders(plan, prisma);
  const donutShopA = await runOrgSeeders(plan, prisma, users);

  await runAfterOrgSeeders(plan, prisma, users, donutShopA);

  return { users, donutShopA } satisfies SeedContext;
}