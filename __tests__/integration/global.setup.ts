import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

/**
 * Vitest global setup for integration tests — runs once in the main process
 * before any workers are spawned.
 *
 * Loads .env.local and reseeds the dev database so every integration test run
 * starts from a known, consistent state. Tests can freely read and write to
 * the DB — no teardown needed, the next run's reseed will clean everything up.
 *
 * In CI, seeding is skipped if the database is already seeded by the workflow.
 */
export default function globalSetup() {
  // Load .env.local so DATABASE_URL and SEED_DEV_IDENTIFIERS are available
  // for the seed subprocess.
  config({
    path: resolve(process.cwd(), ".env"),
    override: false,
    quiet: true,
  });
  config({
    path: resolve(process.cwd(), ".env.local"),
    override: true,
    quiet: true,
  });

  if (process.env.CI) {
    console.log(
      "\n[integration setup] CI environment detected — skipping reseed (already seeded by workflow).\n",
    );
    return;
  }

  console.log("\n[integration setup] Reseeding dev database...");
  execSync("pnpm seed:dev", { stdio: "inherit", env: process.env });
  console.log("[integration setup] Seed complete.\n");
}
