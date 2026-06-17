import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";

/**
 * Playwright global teardown — runs once after all tests finish.
 *
 * Cleans the current seed namespace so the shared dev database does not keep
 * dead test data around after a successful or failed E2E run.
 */
export default function globalTeardown() {
  if (process.env.CI) {
    console.log(
      "\n[global teardown] CI environment detected — still cleaning namespace-scoped seed data.\n",
    );
  }

  config({ path: resolve(process.cwd(), ".env.local"), override: true });

  console.log("\n[global teardown] Cleaning namespace-scoped seed data...");
  execSync("pnpm seed:clean", { stdio: "inherit", env: process.env });
  console.log("[global teardown] Cleanup complete.\n");
}
