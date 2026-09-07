import { PrismaClient, AnnouncementScope } from "@prisma/client";
import { seedDisplayName, seedEmail } from "@/lib/demo/seed-namespace";
import { createAnnouncement } from "@/lib/services/announcements";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../shared/users";
import type { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

const ANNOUNCEMENT_FIXTURES = Array.from({ length: 5 }, (_, index) => {
  const number = index + 1;
  return {
    title: `MainDev Announcement ${number}`,
    description: `Announcement ${number} from [MAIN] Donut Shop A for MainDev.`,
  };
});

const GENERAL_NOTIFICATION_FIXTURES = [
  {
    message: "Notification Org posted a new update for MainDev.",
    seenAt: null,
  },
  {
    message: "Notification Org assigned a fresh task to MainDev.",
    seenAt: null,
  },
  {
    message: "Notification Org shared a reminder with MainDev.",
    seenAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    message: "Notification Org added a note for MainDev.",
    seenAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    message: "Notification Org marked a checklist item complete for MainDev.",
    seenAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
] as const;

export async function seedNotifications(
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const recipient = users.owner;

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

  await prisma.notification.deleteMany({
    where: {
      userId: recipient.id,
      OR: [
        { message: { startsWith: `${orgName} ` } },
        { message: { startsWith: "[DEMO] Notification " } },
      ],
    },
  });

  const now = Date.now();
  const notifications = GENERAL_NOTIFICATION_FIXTURES.map((fixture, index) => ({
    userId: recipient.id,
    message: `[DEMO] Notification ${index + 1}: ${fixture.message}`,
    seenAt: fixture.seenAt,
    createdAt: new Date(now - index * 12 * 60 * 60 * 1000),
  }));

  await prisma.notification.createMany({
    data: notifications,
  });

  await prisma.announcement.deleteMany({
    where: {
      orgId: donutShopA.org.id,
      title: { startsWith: "MainDev Announcement " },
    },
  });

  for (const fixture of ANNOUNCEMENT_FIXTURES) {
    const result = await createAnnouncement(
      donutShopA.org.id,
      {
        title: fixture.title,
        description: fixture.description,
        scope: AnnouncementScope.ORG,
      },
      donutShopA.org.ownerId,
      recipient.email,
    );

    if (!result.ok) {
      throw new Error(result.error);
    }
  }
}

export function registerNotificationSeeds(plan: SeedPlan) {
  // Register the notification seed after org setup so it can reference the seeded org and user records.
  plan.afterOrg.push(async (prisma, users, donutShopA) => {
    await seedNotifications(prisma, users, donutShopA);
  });
}