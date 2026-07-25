import { PrismaClient, InviteType } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../shared/users";
import { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

export async function seedInvites(
  prisma: PrismaClient,
  users: Users,
  org1: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  // Seed only the invite that matters for the notification/invite flow being exercised.
  await prisma.invite.createMany({
    data: [
        // Keep one representative bot-slot invite so the notification seed stays realistic.
      {
        orgId: org1.org.id,
        invitedById: users.owner.id,
        recipientId: users.sam.id,
        type: InviteType.MEMBER,
        orgName: org1.org.name,
        inviterName: users.owner.name ?? "Owner",
        metadata: {
          roleIds: [org1.roles.roleWorker.id],
          workingDays: ["mon", "wed", "fri"],
          botMembershipId: org1.botOpenSlot.id,
        },
      },
    ],
  });
}

export function registerInviteSeeds(plan: SeedPlan) {
  // Register the invite seed to run after org creation so the org IDs and role IDs already exist.
  plan.afterOrg.push(seedInvites);
}