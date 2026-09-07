import { PrismaClient } from "@prisma/client";
import { ROLE_KEYS } from "@/lib/auth/rbac";
import { seedDisplayName, seedEmail } from "@/lib/demo/seed-namespace";
import { createFranchiseToken } from "@/lib/services/franchise";
import { createMemberInvite } from "@/lib/services/invites";
import type { SeedPlan } from "../seed-plan";
import type { Users } from "../shared/users";
import { ALL_OWNER_PERMISSIONS } from "../helpers";

const INVITE_FIXTURES = [
  {
    kind: "member" as const,
    orgBaseName: "Invite Org Alpha",
    ownerBaseName: "Invite Owner Alpha",
    address: "12 Harbour Street, Sydney NSW 2000",
    timezone: "Australia/Sydney",
    workingDays: ["mon", "wed", "fri"],
  },
  {
    kind: "franchise" as const,
    orgBaseName: "Franchise Org Beta",
    ownerBaseName: "Franchise Owner Beta",
    address: "88 Collins Street, Melbourne VIC 3000",
    timezone: "Australia/Melbourne",
    workingDays: ["tue", "thu"],
  },
] as const;

const INVITE_OWNER_EMAIL_KEYS = [
  "invite-owner-1",
  "invite-owner-2",
  "invite-owner-3",
  "invite-owner-4",
  "invite-owner-5",
] as const;

export async function seedInvites(
  prisma: PrismaClient,
  users: Users,
  _donutShopA: unknown,
) {
  const recipient = users.owner;

  await prisma.invite.deleteMany({
    where: { recipientId: recipient.id },
  });
  await prisma.franchiseToken.deleteMany({
    where: { invitedEmail: recipient.email },
  });
  await prisma.organization.deleteMany({
    where: {
      owner: {
        email: {
          in: INVITE_OWNER_EMAIL_KEYS.map((key) => seedEmail(key)),
        },
      },
    },
  });

  for (const [index, fixture] of INVITE_FIXTURES.entries()) {
    const owner = await prisma.user.upsert({
      where: { email: seedEmail(`invite-owner-${index + 1}`) },
      update: {
        name: seedDisplayName(fixture.ownerBaseName),
        image: `https://i.pravatar.cc/150?img=${20 + index}`,
      },
      create: {
        email: seedEmail(`invite-owner-${index + 1}`),
        name: seedDisplayName(fixture.ownerBaseName),
        image: `https://i.pravatar.cc/150?img=${20 + index}`,
      },
    });

    const recipientOrgName = seedDisplayName(fixture.orgBaseName);
    await prisma.organization.deleteMany({
      where: { name: recipientOrgName, ownerId: owner.id },
    });

    const org = await prisma.organization.create({
      data: {
        name: recipientOrgName,
        ownerId: owner.id,
        address: fixture.address,
        timezone: fixture.timezone,
        operatingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
    });
    const [roleOwner, roleWorker] = await prisma.role
      .createManyAndReturn({
        data: [
          { orgId: org.id, name: "Owner", key: ROLE_KEYS.OWNER, color: "#ef4444", isDeletable: false, isDefault: false },
          { orgId: org.id, name: "Default Member", key: ROLE_KEYS.DEFAULT_MEMBER, color: "#6b7280", isDeletable: false, isDefault: true },
        ],
      })
      .then((rows) => [
        rows.find((role) => role.key === ROLE_KEYS.OWNER)!,
        rows.find((role) => role.key === ROLE_KEYS.DEFAULT_MEMBER)!,
      ] as const);

    await prisma.permission.createMany({
      data: ALL_OWNER_PERMISSIONS.map((action) => ({ roleId: roleOwner.id, action })),
      skipDuplicates: true,
    });

    const memberships = await prisma.membership.createManyAndReturn({
      data: [{ orgId: org.id, userId: owner.id, workingDays: ["mon", "tue", "wed", "thu", "fri"] }],
    });
    await prisma.memberRole.createMany({
      data: [{ membershipId: memberships[0].id, roleId: roleOwner.id }],
    });

    if (fixture.kind === "member") {
      const result = await createMemberInvite(
        org.id,
        owner.id,
        recipient.id,
        [roleWorker.id],
        fixture.workingDays,
        { actorEmail: owner.email },
      );

      if (!result.ok) {
        throw new Error(result.error);
      }
      continue;
    }

    const franchiseInvite = await createFranchiseToken(
      org.id,
      recipient.email,
      owner.id,
      owner.id,
      owner.email,
    );

    if (!franchiseInvite.ok) {
      throw new Error(franchiseInvite.error);
    }
  }
}

export function registerInviteSeeds(plan: SeedPlan) {
  // Register the invite seed to run after org creation so the org IDs and role IDs already exist.
  plan.afterOrg.push(seedInvites);
}