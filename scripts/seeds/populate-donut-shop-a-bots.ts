/**
 * Seed script that populates 50 bot memberships into Donut Shop A.
 *
 * Safe to re-run: it removes any previously generated bot memberships for the
 * seeded Donut Shop A org before recreating the 50-row set.
 *
 * Run with:
 *   npx tsx scripts/seeds/populate-donut-shop-a-bots.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

import { PrismaClient, MembershipStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDisplayName } from "@/lib/seed-namespace";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

const ORG_NAME = seedDisplayName("Donut Shop A");
const BOT_NAME_PREFIX = "Donut Shop A Bot ";
const BOT_COUNT = 50;

const WORKING_DAY_PATTERNS = [
  ["mon", "tue", "wed", "thu", "fri"],
  ["tue", "wed", "thu", "fri", "sat"],
  ["mon", "wed", "fri"],
  ["tue", "thu", "sat"],
  ["mon", "tue", "sat", "sun"],
  ["wed", "thu", "fri", "sat"],
  ["mon", "sun"],
  ["thu", "fri", "sat", "sun"],
] as const;

function pad(index: number): string {
  return String(index).padStart(2, "0");
}

function buildBotName(index: number): string {
  return `${BOT_NAME_PREFIX}${pad(index)}`;
}

function buildWorkingDays(index: number): string[] {
  return [...WORKING_DAY_PATTERNS[(index - 1) % WORKING_DAY_PATTERNS.length]];
}

async function main() {
  console.log("Starting Donut Shop A bot population...");

  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true, name: true },
  });

  if (!org) {
    console.error(`Could not find seeded org: ${ORG_NAME}`);
    process.exit(1);
  }

  const defaultRole = await prisma.role.findFirst({
    where: { orgId: org.id, isDefault: true },
    select: { id: true, name: true },
  });

  const deleted = await prisma.membership.deleteMany({
    where: {
      orgId: org.id,
      userId: null,
      botName: { startsWith: BOT_NAME_PREFIX },
    },
  });

  console.log(`Found org: ${org.name} (${org.id})`);
  console.log(`Removed ${deleted.count} existing generated bot membership(s).`);

  const botMemberships = await prisma.membership.createManyAndReturn({
    data: Array.from({ length: BOT_COUNT }, (_, index) => {
      const botNumber = index + 1;
      return {
        orgId: org.id,
        userId: null,
        botName: buildBotName(botNumber),
        workingDays: buildWorkingDays(botNumber),
        status: MembershipStatus.ACTIVE,
      };
    }),
    select: { id: true, botName: true },
  });

  if (defaultRole) {
    await prisma.memberRole.createMany({
      data: botMemberships.map((membership) => ({
        membershipId: membership.id,
        roleId: defaultRole.id,
      })),
      skipDuplicates: true,
    });
    console.log(`Assigned default role to ${botMemberships.length} bot membership(s).`);
  } else {
    console.warn("No default role found for Donut Shop A; bots were created without role assignments.");
  }

  console.log(`Created ${botMemberships.length} bot membership(s):`);
  console.log(
    botMemberships
      .slice(0, 5)
      .map((membership) => `  - ${membership.botName}`)
      .join("\n"),
  );
  if (botMemberships.length > 5) {
    console.log(`  ... and ${botMemberships.length - 5} more.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());