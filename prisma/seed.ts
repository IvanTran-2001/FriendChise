import dotenv from "dotenv";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", override: true, quiet: true });

import {
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runSeedPlan } from "./seeds/seed-plan";
import { cleanupSeedNamespace } from "./seeds/helpers/namespace-cleanup";

// This is the seed entrypoint: it validates the target DB, clears namespace-scoped
// seed data, then hands off to the seed plan.
let prisma: PrismaClient;
let dbUrl: string;
const seedStartedAt = Date.now();
let seedSucceeded = false;

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function confirm(): void {
  dbUrl = process.env.DATABASE_URL ?? "";

  // Validate DATABASE_URL is present
  if (!dbUrl) {
    console.error("  ❌ ERROR: DATABASE_URL is not set.");
    console.error("  Ensure .env is present with DATABASE_URL set to your local database.\n");
    process.exit(1);
  }

  // Validate DATABASE_URL is a valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
  } catch {
    console.error("  ❌ ERROR: DATABASE_URL is not a valid URL.");
    process.exit(1);
  }

  // Guard: refuse to seed anything that doesn't look like a local/dev database
  const devIdentifiers = (process.env.SEED_DEV_IDENTIFIERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocal =
    // Exact localhost variants only — no substring matching
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname === "::1" ||
    // "dev" must be a complete dot-separated segment (e.g. "dev.db.internal"),
    // not a substring of another segment (e.g. "prod-dev.db.internal" is rejected)
    /(?:^|\.)dev(?:\.|$)/i.test(parsedUrl.hostname) ||
    // "dev" must be a standalone word in the username, delimited by . _ - or boundary
    // (e.g. "dev", "dev_admin", "admin_dev" — but NOT "devops" or "admin-devops")
    /(?:^|[._-])dev(?:[._-]|$)/i.test(parsedUrl.username) ||
    // Explicit opt-in: exact full hostname or username match only
    devIdentifiers.some(
      (id) => parsedUrl.username === id || parsedUrl.hostname === id,
    );

  console.log("");
  console.log(`  Target database : ${parsedUrl.hostname}`);

  if (!isLocal) {
    console.error("  ❌ ERROR: Seeding is only allowed against a local/dev database.");
    console.error("  If this is a dev database, add its hostname or username to SEED_DEV_IDENTIFIERS in .env.local.");
    console.error("  Aborted — nothing was changed.\n");
    process.exit(1);
  }

  console.log("");

  // Initialize Prisma client after validation
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });
}

async function main() {
  confirm();
  await cleanupSeedNamespace(prisma);
  await prisma.$disconnect();
  prisma = createPrismaClient();
  const { users, donutShopA: org1 } = await runSeedPlan(prisma);
  seedSucceeded = true;

  console.log("Seeded successfully:", {
    users: Object.fromEntries(Object.entries(users).map(([k, v]) => [k, v.id])),
    orgs: {
      "Donut Shop A": org1.org.id,
    },
  });
}

main()
  .catch(async (e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const elapsedMs = Date.now() - seedStartedAt;
    if (seedSucceeded) {
      console.log(`Seed completed in ${formatDuration(elapsedMs)}`);
    } else {
      console.log(`Seed stopped after ${formatDuration(elapsedMs)}`);
    }
    await prisma.$disconnect();
  });
