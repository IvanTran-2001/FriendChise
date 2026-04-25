import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

/**
 * Playwright global setup — runs once before all tests, before the webServer starts.
 *
 * Reseeds the dev database so every test run starts from a known, consistent
 * state. Tests can freely read and write to the DB without worrying about
 * teardown or leftover data.
 */
export default function globalSetup() {
  // Load .env.local so DATABASE_URL points to the dev DB before spawning the
  // seed subprocess. dotenv.config() inside seed.ts won't override an
  // already-set env var, so this takes precedence over .env (prod).
  config({ path: resolve(process.cwd(), ".env.local"), override: true });

  console.log("\n[global setup] Reseeding dev database...");
  execSync("pnpm seed:dev", { stdio: "inherit", env: process.env });
  console.log("[global setup] Seed complete.\n");
}
