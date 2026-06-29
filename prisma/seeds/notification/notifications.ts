import { PrismaClient } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../users";
import type { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

const NOTIFICATION_MESSAGES = [
  "Donut Shop A invited you to join as a franchisee.",
  "Donut Shop A sent another franchise invite for MainDev.",
  "A new org invite from Donut Shop A is waiting for you.",
  "Donut Shop A reminded MainDev about the franchise invite.",
  "Donut Shop A is still waiting on your franchise invite response.",
];

export async function seedNotifications(
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const maindevName = users.owner.name ?? "MainDev";
  const orgName = donutShopA.org.name;
  const now = Date.now();
  // Spread the notification timestamps out so the feed has a realistic ordering and seen/unseen mix.
  const notifications = Array.from({ length: 30 }, (_, index) => ({
    userId: users.owner.id,
    message: `${orgName} invited ${maindevName} to join as a franchisee. ${NOTIFICATION_MESSAGES[index % NOTIFICATION_MESSAGES.length]}`,
    seenAt: index < 10 ? null : new Date(now - index * 60 * 60 * 1000),
    createdAt: new Date(now - index * 12 * 60 * 60 * 1000),
  }));

  await prisma.notification.createMany({
    data: notifications,
  });
}

export function registerNotificationSeeds(plan: SeedPlan) {
  // Register the notification seed after org setup so it can reference the seeded org and user records.
  plan.afterOrg.push(async (prisma, users, donutShopA) => {
    await seedNotifications(prisma, users, donutShopA);
  });
}