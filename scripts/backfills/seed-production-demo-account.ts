/**
 * Production-safe demo seeding script for a specific account.
 *
 * This reuses the same seed modules as the local demo database, but targets a
 * single production test account instead of the namespaced example.test users.
 *
 * Run in dev:
 *   npx tsx scripts/backfills/seed-production-demo-account.ts --email=testfriendchise@gmail.com
 *
 * Run in production:
 *   npx tsx scripts/backfills/seed-production-demo-account.ts --confirm-production --email=testfriendchise@gmail.com
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
if (!process.env.SKIP_DOTENV_LOCAL) {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
}

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_KEYS } from "@/lib/auth/rbac";
import { MAIN_DEV_EMAIL, seedDisplayName } from "@/lib/demo/seed-namespace";
import { resolveDatabaseTarget } from "./db-target";
import { seedEmptyOrgs } from "../../prisma/seeds/dummies/empty-orgs";
import { ALL_OWNER_PERMISSIONS } from "../../prisma/seeds/helpers";
import { seedUsers, type Users } from "../../prisma/seeds/shared/users";
import { seedDonutShopA } from "../../prisma/seeds/orgs/donut-shop-a/donut-shop-a";

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const databaseTarget = resolveDatabaseTarget(dbUrl);
const isProductionConfirmed = process.argv.includes("--confirm-production");

if (databaseTarget.isProductionTarget && !isProductionConfirmed) {
  console.error(
    `Set --confirm-production to run against the production-targeted database (${databaseTarget.hostname}).`,
  );
  process.exit(1);
}

type ParsedArgs = {
  email: string;
  namespace: string;
  confirmTargetDeletes?: string;
};

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

const ANNOUNCEMENT_FIXTURES = Array.from({ length: 5 }, (_, index) => {
  const number = index + 1;
  return {
    title: `MainDev Announcement ${number}`,
    description: `Announcement ${number} from [MAIN] Donut Shop A for MainDev.`,
  };
});

const GENERAL_NOTIFICATION_FIXTURES = [
  { message: "Notification Org posted a new update for MainDev.", seenAt: null },
  { message: "Notification Org assigned a fresh task to MainDev.", seenAt: null },
  { message: "Notification Org shared a reminder with MainDev.", seenAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  { message: "Notification Org added a note for MainDev.", seenAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  { message: "Notification Org marked a checklist item complete for MainDev.", seenAt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
] as const;

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

function parseArgs(): ParsedArgs {
  return {
    email: readArg("email") ?? MAIN_DEV_EMAIL,
    namespace: readArg("namespace") ?? "ivan-tran",
    confirmTargetDeletes: readArg("confirm-target-deletes"),
  };
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "[redacted]";
  return `${localPart.slice(0, 2)}***@${domain}`;
}

function isMainDevTarget(email: string): boolean {
  return email.trim().toLowerCase() === MAIN_DEV_EMAIL;
}

function shouldAllowDeletes(targetEmail: string, confirmTargetDeletes?: string): boolean {
  if (isMainDevTarget(targetEmail)) return true;
  return confirmTargetDeletes === targetEmail;
}

async function seedProductionAccount(targetEmail: string, namespace: string) {
  process.env.SEED_NAMESPACE = namespace;

  const { confirmTargetDeletes } = parseArgs();
  const allowDeletes = shouldAllowDeletes(targetEmail, confirmTargetDeletes);
  if (!allowDeletes) {
    console.error(
      `Refusing to run destructive cleanup for non-canonical target ${maskEmail(targetEmail)}. Pass --confirm-target-deletes=<exact target email> to proceed.`,
    );
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    const users = (await seedUsers(tx)) as Users;

    const owner = await tx.user.upsert({
      where: { email: targetEmail },
      update: {
        name: seedDisplayName("MainDev"),
        image: "https://i.pravatar.cc/150?img=3",
      },
      create: {
        email: targetEmail,
        name: seedDisplayName("MainDev"),
        image: "https://i.pravatar.cc/150?img=3",
      },
    });

    users.owner = owner;

    await tx.notification.deleteMany({ where: { userId: owner.id } });
    await tx.invite.deleteMany({ where: { recipientId: owner.id } });
    await tx.franchiseToken.deleteMany({ where: { invitedEmail: owner.email } });
    await tx.organization.deleteMany({ where: { ownerId: owner.id } });

    const donutShopA = await seedDonutShopA(tx, users);
    await seedEmptyOrgs(tx, users);
    await seedInviteFixtures(tx, owner, donutShopA.org.id);
      await seedProductionNotifications(tx, owner.id, donutShopA.org.id);

    console.log("Production demo account seeded:", {
      account: maskEmail(owner.email),
      status: "seeded",
    });
  }, { maxWait: 30_000, timeout: 300_000 });
}

async function seedInviteFixtures(
  prisma: Prisma.TransactionClient,
  recipient: { id: string; email: string; name: string | null },
  _donutShopAOrgId: string,
) {
  await prisma.invite.deleteMany({ where: { recipientId: recipient.id } });
  await prisma.franchiseToken.deleteMany({ where: { invitedEmail: recipient.email } });
  await prisma.organization.deleteMany({
    where: {
      owner: {
        email: { in: INVITE_OWNER_EMAIL_KEYS.map((key) => `${key}+${process.env.SEED_NAMESPACE ?? "ivan-tran"}@example.test`) },
      },
    },
  });

  for (const [index, fixture] of INVITE_FIXTURES.entries()) {
    const owner = await prisma.user.upsert({
      where: { email: `${`invite-owner-${index + 1}`}+${process.env.SEED_NAMESPACE ?? "ivan-tran"}@example.test` },
      update: {
        name: seedDisplayName(fixture.ownerBaseName),
        image: `https://i.pravatar.cc/150?img=${20 + index}`,
      },
      create: {
        email: `${`invite-owner-${index + 1}`}+${process.env.SEED_NAMESPACE ?? "ivan-tran"}@example.test`,
        name: seedDisplayName(fixture.ownerBaseName),
        image: `https://i.pravatar.cc/150?img=${20 + index}`,
      },
    });

    const recipientOrgName = seedDisplayName(fixture.orgBaseName);
    await prisma.organization.deleteMany({ where: { name: recipientOrgName, ownerId: owner.id } });

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
    await prisma.memberRole.createMany({ data: [{ membershipId: memberships[0].id, roleId: roleOwner.id }] });

    if (fixture.kind === "member") {
      await prisma.invite.create({
        data: {
          orgId: org.id,
          invitedById: owner.id,
          recipientId: recipient.id,
          type: "MEMBER",
          orgName: org.name,
          inviterName: owner.name,
          metadata: { roleIds: [roleWorker.id], workingDays: fixture.workingDays },
        },
      });
      continue;
    }

    const franchiseToken = await prisma.franchiseToken.create({
      data: {
        orgId: org.id,
        invitedEmail: recipient.email,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { token: true, expiresAt: true },
    });

    await prisma.invite.create({
      data: {
        orgId: org.id,
        invitedById: owner.id,
        recipientId: recipient.id,
        type: "FRANCHISE",
        orgName: org.name,
        inviterName: owner.name,
        expiresAt: franchiseToken.expiresAt,
        metadata: { token: franchiseToken.token },
      },
    });
  }
}

async function seedProductionNotifications(
  prisma: Prisma.TransactionClient,
  recipientId: string,
     donutShopAOrgId: string,
   ) {
  const now = Date.now();
  const notificationOwner = await prisma.user.upsert({
    where: { email: `${"notification-owner"}+${process.env.SEED_NAMESPACE ?? "ivan-tran"}@example.test` },
    update: {
      name: seedDisplayName("Notification Owner"),
      image: "https://i.pravatar.cc/150?img=24",
    },
    create: {
      email: `${"notification-owner"}+${process.env.SEED_NAMESPACE ?? "ivan-tran"}@example.test`,
      name: seedDisplayName("Notification Owner"),
      image: "https://i.pravatar.cc/150?img=24",
    },
  });

  const notificationOrgName = seedDisplayName("Notification Org");
  await prisma.organization.deleteMany({
    where: { name: notificationOrgName, ownerId: notificationOwner.id },
  });
  await prisma.organization.create({
    data: {
      name: notificationOrgName,
      ownerId: notificationOwner.id,
      address: "14 Notification Lane, Sydney NSW 2000",
      timezone: "Australia/Sydney",
      operatingDays: ["mon", "tue", "wed", "thu", "fri"],
    },
  });

  await prisma.notification.deleteMany({
    where: {
      userId: recipientId,
      OR: [
        { message: { startsWith: `${notificationOrgName} ` } },
        { message: { startsWith: "[DEMO] Notification " } },
      ],
    },
  });

  await prisma.notification.createMany({
    data: GENERAL_NOTIFICATION_FIXTURES.map((fixture, index) => ({
      userId: recipientId,
      message: `[DEMO] Notification ${index + 1}: ${fixture.message}`,
      seenAt: fixture.seenAt,
      createdAt: new Date(now - index * 12 * 60 * 60 * 1000),
    })),
  });

  await prisma.announcement.deleteMany({
    where: {
      orgId: donutShopAOrgId,
      title: { startsWith: "MainDev Announcement " },
    },
  });

  await prisma.announcement.createMany({
    data: ANNOUNCEMENT_FIXTURES.map((fixture) => ({
      orgId: donutShopAOrgId,
      scope: "ORG",
      title: fixture.title,
      description: fixture.description,
    })),
  });
}

async function main() {
  const { email, namespace } = parseArgs();
  await seedProductionAccount(email, namespace);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());