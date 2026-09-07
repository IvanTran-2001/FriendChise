/**
 * Production-safe user update script for a specific account.
 *
 * By default it targets testfriendchise@gmail.com, but the email and the fields
 * to update are all explicit so the script can be reused safely for a one-off
 * production account fix.
 *
 * Run in dev:
 *   npx tsx scripts/backfills/update-production-account.ts --email=testfriendchise@gmail.com --name="Test FriendChise"
 *
 * Run in production:
 *   npx tsx scripts/backfills/update-production-account.ts --confirm-production --email=testfriendchise@gmail.com --name="Test FriendChise"
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });
if (!process.env.SKIP_DOTENV_LOCAL) {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MAIN_DEV_EMAIL } from "@/lib/demo/seed-namespace";
import { resolveDatabaseTarget } from "./db-target";

type ParsedArgs = {
  email: string;
  name?: string;
  image?: string;
  newEmail?: string;
};

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

function parseArgs(): ParsedArgs {
  const email = readArg("email") ?? MAIN_DEV_EMAIL;
  const name = readArg("name");
  const image = readArg("image");
  const newEmail = readArg("new-email");

  return { email, name, image, newEmail };
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "[redacted]";
  return `${localPart.slice(0, 2)}***@${domain}`;
}

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const databaseTarget = resolveDatabaseTarget(dbUrl);
if (databaseTarget.isProductionTarget && !process.argv.includes("--confirm-production")) {
  console.error(
    `Set --confirm-production to run against the production-targeted database (${databaseTarget.hostname}).`,
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = parseArgs();

  const user = await prisma.user.findUnique({
    where: { email: args.email },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!user) {
    console.error(`User not found for account: ${maskEmail(args.email)}`);
    process.exit(1);
  }

  const data: { email?: string; name?: string; image?: string } = {};
  if (args.newEmail) data.email = args.newEmail;
  if (args.name !== undefined) data.name = args.name;
  if (args.image !== undefined) data.image = args.image;

  if (Object.keys(data).length === 0) {
    console.error("No update fields were provided.");
    process.exit(1);
  }

  console.log("Updating user:", { account: maskEmail(user.email), status: "pending" });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true, image: true },
  });

  console.log("Updated user:", { account: maskEmail(updated.email), status: "updated" });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());