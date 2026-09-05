import { PrismaClient } from "@prisma/client";
import { seedDisplayName, seedEmail } from "@/lib/demo/seed-namespace";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../shared/users";
import type { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

const NOTIFICATION_MESSAGES = [
  "Donut Shop A invited you to join as a franchisee.",
  "Donut Shop A sent another franchise invite.",
  "A new org invite from Donut Shop A is waiting for you.",
  "Donut Shop A sent a reminder about the franchise invite.",
  "Donut Shop A is still waiting on your franchise invite response.",
];

export async function seedNotifications(
  prisma: PrismaClient,
  _users: Users,
  _donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const recipient = await prisma.user.upsert({
    where: { email: seedEmail("notification-recipient") },
    update: {
      name: seedDisplayName("Notification Recipient"),
      image: "https://i.pravatar.cc/150?img=23",
    },
    create: {
      email: seedEmail("notification-recipient"),
      name: seedDisplayName("Notification Recipient"),
      image: "https://i.pravatar.cc/150?img=23",
    },
  });

  const orgOwner = await prisma.user.upsert({
    where: { email: seedEmail("notification-owner") },
    update: {
      name: seedDisplayName("Notification Owner"),
      image: "https://i.pravatar.cc/150?img=24",
    },
    create: {
      email: seedEmail("notification-owner"),
      name: seedDisplayName("Notification Owner"),
      image: "https://i.pravatar.cc/150?img=24",
    },
  });

  const orgName = seedDisplayName("Notification Org");
  await prisma.organization.deleteMany({
    where: { name: orgName, ownerId: orgOwner.id },
  });

  await prisma.organization.create({
    data: {
      name: orgName,
      ownerId: orgOwner.id,
      address: "14 Notification Lane, Sydney NSW 2000",
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri"],
    },
  });

  const recipientName = recipient.name ?? "Notification Recipient";
  const now = Date.now();
  // Spread the notification timestamps out so the feed has a realistic ordering and seen/unseen mix.
  const notifications = Array.from({ length: 30 }, (_, index) => ({
    userId: recipient.id,
    message: `${orgName} invited ${recipientName} to join as a franchisee. ${NOTIFICATION_MESSAGES[index % NOTIFICATION_MESSAGES.length]}`,
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