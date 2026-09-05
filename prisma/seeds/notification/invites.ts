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
    orgBaseName: "Invite Org Alpha",
    ownerBaseName: "Invite Owner Alpha",
    recipientBaseName: "Invite Recipient Alpha",
    address: "12 Harbour Street, Sydney NSW 2000",
    timezone: "Australia/Sydney",
    workingDays: ["mon", "wed", "fri"],
  },
  {
    orgBaseName: "Invite Org Beta",
    ownerBaseName: "Invite Owner Beta",
    recipientBaseName: "Invite Recipient Beta",
    address: "88 Collins Street, Melbourne VIC 3000",
    timezone: "Australia/Melbourne",
    workingDays: ["tue", "thu"],
  },
  {
    orgBaseName: "Invite Org Gamma",
    ownerBaseName: "Invite Owner Gamma",
    recipientBaseName: "Invite Recipient Gamma",
    address: "44 Queen Street, Brisbane QLD 4000",
    timezone: "Australia/Brisbane",
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
  },
  {
    orgBaseName: "Invite Org Delta",
    ownerBaseName: "Invite Owner Delta",
    recipientBaseName: "Invite Recipient Delta",
    address: "15 Rundle Mall, Adelaide SA 5000",
    timezone: "Australia/Adelaide",
    workingDays: ["sat", "sun"],
  },
  {
    orgBaseName: "Invite Org Epsilon",
    ownerBaseName: "Invite Owner Epsilon",
    recipientBaseName: "Invite Recipient Epsilon",
    address: "61 Murray Street, Perth WA 6000",
    timezone: "Australia/Perth",
    workingDays: ["mon", "wed", "fri"],
  },
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

    const orgName = seedDisplayName(fixture.orgBaseName);
    await prisma.organization.deleteMany({
      where: { name: orgName, ownerId: owner.id },
    });

    const org = await prisma.organization.create({
      data: {
        name: orgName,
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