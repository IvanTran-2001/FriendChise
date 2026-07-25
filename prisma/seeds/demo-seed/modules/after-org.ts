import type { PrismaClient } from "@prisma/client";
import type { SeedPlan } from "../../seed-plan";
import { seedRandomAuditLogs } from "../../helpers/audit-logs";
import { seedConversionData } from "../../orgs/walker's doughnut/walkers-doughnuts";
import { registerEmptyOrgSeeds } from "../../dummies/empty-orgs";
import { registerInviteSeeds } from "../../notification/invites";
import { registerNotificationSeeds } from "../../notification/notifications";
import type { Users } from "../../shared/users";
import { seedDonutShopA } from "../../orgs/donut-shop-a/donut-shop-a";

type DemoAfterOrgSeeder = (
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) => Promise<void>;

function registerDemoAfterOrgSeeder(plan: SeedPlan, seeder: DemoAfterOrgSeeder) {
  plan.afterOrg.push(seeder);
}

// Demo database follow-up seeds live here: they need users and the org seeded first.
export function registerDemoAfterOrgSeeds(plan: SeedPlan) {
  registerDemoAfterOrgSeeder(plan, async (prisma, _users, donutShopA) => {
    await seedConversionData(prisma, donutShopA.org.id);
  });
  registerDemoAfterOrgSeeder(plan, async (prisma, users, donutShopA) => {
    await seedRandomAuditLogs(prisma, donutShopA.org.id, users);
  });
  registerEmptyOrgSeeds(plan);
  registerInviteSeeds(plan);
  registerNotificationSeeds(plan);
}