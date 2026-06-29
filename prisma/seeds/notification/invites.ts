import { PrismaClient, InviteType, InviteStatus } from "@prisma/client";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../users";
import { seedDonutShopA } from "../orgs/donut-shop-a/donut-shop-a";

export async function seedInvites(
  prisma: PrismaClient,
  users: Users,
  org1: Awaited<ReturnType<typeof seedDonutShopA>>,
) {
  const invites = [
    // Bot-slot invite — Sam invited to fill "Open Slot" bot in Donut Shop A
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
  ];

  // Dummy invites for 'riley'
  for (let i = 0; i < 30; i++) {
    invites.push({
      orgId: org1.org.id,
      invitedById: users.owner.id,
      recipientId: users.riley.id,
      type: InviteType.MEMBER,
      orgName: org1.org.name,
      inviterName: users.owner.name ?? "Owner",
      metadata: {
        roleIds: [org1.roles.roleWorker.id],
        workingDays: ["tue", "thu"],
      },
      status: i % 4 === 0 ? InviteStatus.ACCEPTED : i % 5 === 0 ? InviteStatus.DECLINED : InviteStatus.PENDING,
    } as any);
  }

  // Dummy invites for 'owner'
  for (let i = 0; i < 30; i++) {
    invites.push({
      orgId: org1.org.id,
      invitedById: users.owner.id,
      recipientId: users.owner.id,
      type: InviteType.MEMBER,
      orgName: "Dummy Franchise " + (i + 1),
      inviterName: "Franchise Owner " + (i + 1),
      metadata: {
        roleIds: [org1.roles.roleOwner.id],
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
      status: i % 3 === 0 ? InviteStatus.ACCEPTED : InviteStatus.PENDING,
    } as any);
  }

  await prisma.invite.createMany({
    data: invites,
  });
}

export function registerInviteSeeds(plan: SeedPlan) {
  plan.afterOrg.push(seedInvites);
}