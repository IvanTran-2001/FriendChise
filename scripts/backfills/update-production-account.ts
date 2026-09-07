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
const isProductionConfirmed =
  process.env.NODE_ENV === "production" ||
  process.argv.includes("--confirm-production");

if (!isProductionConfirmed && !process.env.SKIP_DOTENV_LOCAL) {
  dotenv.config({ path: ".env.local", override: true, quiet: true });
}

if (process.env.NODE_ENV === "production" && !process.argv.includes("--confirm-production")) {
  console.error(
    "Set NODE_ENV != production or pass --confirm-production to run against prod.",
  );
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MAIN_DEV_EMAIL } from "@/lib/demo/seed-namespace";

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
  const name = readArg("name") ?? "MainDev";
  const image = readArg("image") ?? "https://i.pravatar.cc/150?img=3";
  const newEmail = readArg("new-email");

  return { email, name, image, newEmail };
}

const dbUrl = process.env.DATABASE_URL!;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
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
    console.error(`User not found for email: ${args.email}`);
    process.exit(1);
  }

  const data: { email?: string; name?: string; image?: string } = {};
  if (args.newEmail) data.email = args.newEmail;
  if (args.name) data.name = args.name;
  if (args.image) data.image = args.image;

  console.log("Updating user:", {
    id: user.id,
    currentEmail: user.email,
    currentName: user.name,
    currentImage: user.image,
    next: data,
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, name: true, image: true },
  });

  console.log("Updated user:", updated);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());