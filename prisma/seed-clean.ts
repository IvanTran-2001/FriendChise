import dotenv from "dotenv";
dotenv.config({ path: ".env", quiet: true });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cleanupSeedNamespace } from "./seeds/helpers/namespace-cleanup";

let prisma: PrismaClient;
const startedAt = Date.now();

function confirm(): void {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("  ❌ ERROR: DATABASE_URL is not set.");
    console.error("  Ensure .env is present with DATABASE_URL set to your local database.\n");
    process.exit(1);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch {
    console.error("  ❌ ERROR: DATABASE_URL is not a valid URL.");
    process.exit(1);
  }

  const devIdentifiers = (process.env.SEED_DEV_IDENTIFIERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const isLocal =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname === "::1" ||
    /(?:^|\.)dev(?:\.|$)/i.test(parsedUrl.hostname) ||
    /(?:^|[._-])dev(?:[._-]|$)/i.test(parsedUrl.username) ||
    devIdentifiers.some((id) => parsedUrl.username === id || parsedUrl.hostname === id);

  console.log("");
  console.log(`  Target database : ${parsedUrl.hostname}`);

  if (!isLocal) {
    console.error("  ❌ ERROR: Cleanup is only allowed against a local/dev database.");
    console.error("  If this is a dev database, add its hostname or username to SEED_DEV_IDENTIFIERS in .env.local.");
    console.error("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  console.log("");

  const adapter = new PrismaPg({ connectionString: dbUrl });
  prisma = new PrismaClient({ adapter });
}

async function main() {
  confirm();
  await cleanupSeedNamespace(prisma);
}

main()
  .catch(async (error) => {
    console.error("Cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const elapsedMs = Date.now() - startedAt;
    console.log(`Cleanup finished in ${elapsedMs}ms`);
    await prisma?.$disconnect();
  });
