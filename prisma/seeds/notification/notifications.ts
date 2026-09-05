import { PrismaClient } from "@prisma/client";
import { AnnouncementScope } from "@prisma/client";
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

export async function seedNotifications(
  prisma: PrismaClient,
  users: Users,
  donutShopA: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const recipient = users.owner;

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