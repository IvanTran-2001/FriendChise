import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

/**
 * Playwright global setup — runs once before all tests, before the webServer starts.
 *
 * Reseeds the dev database so every test run starts from a known, consistent
 * state. Tests can freely read and write to the DB without worrying about
 * teardown or leftover data.
 *
 * In CI the database is already seeded by the workflow before `pnpm test:e2e`
 * runs, so seeding is skipped to avoid a redundant (and potentially
 * conflicting) second seed pass.
 */
export default function globalSetup() {
  if (process.env.CI) {
    console.log(
      "\n[global setup] CI environment detected — skipping reseed (already seeded by workflow).\n",
    );
    return;
  }

  // Load .env.local so DATABASE_URL points to the dev DB before spawning the
  // seed subprocess. dotenv.config() inside seed.ts won't override an
  // already-set env var, so this takes precedence over .env (prod).
  config({ path: resolve(process.cwd(), ".env.local"), override: true });

  // Seed safety check uses SEED_DEV_IDENTIFIERS to recognise non-obvious dev
  // URLs (e.g. Supabase pooler hostnames that don't contain "dev").
  // Explicit opt-in required: set SEED_DEV_IDENTIFIERS or
  // ALLOW_SEED_FROM_DATABASE_URL=true to allow seeding this DB.
  // No automatic allowlisting — prevents accidental seeding of production DBs.
  if (
    !process.env.SEED_DEV_IDENTIFIERS &&
    !process.env.ALLOW_SEED_FROM_DATABASE_URL
  ) {
    console.warn(
      "\n[global setup] WARNING: Neither SEED_DEV_IDENTIFIERS nor ALLOW_SEED_FROM_DATABASE_URL is set.\n" +
        "The seed script may reject this DATABASE_URL. To proceed, either:\n" +
        "  1. Set SEED_DEV_IDENTIFIERS to include your DB hostname/project ref, or\n" +
        "  2. Set ALLOW_SEED_FROM_DATABASE_URL=true to explicitly allow seeding.\n",
    );
  }

  console.log("\n[global setup] Reseeding dev database...");
  execSync("pnpm seed:dev", { stdio: "inherit", env: process.env });
  console.log("[global setup] Seed complete.\n");
}
