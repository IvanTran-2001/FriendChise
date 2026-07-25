import type { PrismaClient } from "@prisma/client";
import { registerDemoSeedModules } from "./demo-seed";
import { registerDevSeedModules } from "./dev-seed";
import { seedDonutShopA } from "./orgs/donut-shop-a/donut-shop-a";
import type { Users } from "./shared/users";

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

// Seed plan is orchestration only.
// It does not define fixture content; it only collects seed modules and runs them in order.
export function createSeedPlan(): SeedPlan {
  return {
    users: [],
    orgs: [],
    afterOrg: [],
  };
}

export function registerSeedModules(plan: SeedPlan) {
  // Demo seed modules build the shared demo database fixtures.
  registerDemoSeedModules(plan);
  // Dev seed modules are intentionally empty unless a local override is needed.
  registerDevSeedModules(plan);
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