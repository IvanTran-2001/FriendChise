import { PrismaClient } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../users";
import { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

export async function seedNotifications(
  prisma: PrismaClient,
  users: Users,
  org1: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const dummyNotifications = [];

  // Generate notifications for 'owner'
  for (let i = 0; i < 50; i++) {
    dummyNotifications.push({
      userId: users.owner.id,
      message: `System alert: Routine check ${i + 1} completed successfully.`,
      seenAt: i < 25 ? new Date() : null, // Half seen, half unseen
    });
  }

  // Generate notifications for 'riley'
  for (let i = 0; i < 50; i++) {
    dummyNotifications.push({
      userId: users.riley.id,
      message: `Update ${i + 1}: Your recent request has been processed.`,
      seenAt: i < 10 ? new Date() : null,
    });
  }

  await prisma.notification.createMany({
    data: dummyNotifications,
  });
}

export function registerNotificationSeeds(plan: SeedPlan) {
  plan.afterOrg.push(seedNotifications);
}
