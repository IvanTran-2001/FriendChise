import { PrismaClient, InviteType } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../users";
import { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

export async function seedInvites(
  prisma: PrismaClient,
  users: Users,
  org1: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  await prisma.invite.createMany({
    data: [
      // Bot-slot invite — Sam invited to fill "Open Slot" bot in Donut Shop A
      {
        orgId: org1.org.id,
        invitedById: users.owner.id,
        recipientId: users.sam.id,
        type: InviteType.MEMBER,
        orgName: "Donut Shop A",
        inviterName: "MainDev",
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
  plan.afterOrg.push(seedInvites);
}