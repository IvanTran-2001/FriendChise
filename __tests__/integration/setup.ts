import { config } from "dotenv";
import { resolve } from "path";

/**
 * Per-worker setup file for integration tests.
 *
 * Vitest workers run in separate processes (pool: "forks"), so environment
 * variables set in global.setup.ts don't automatically carry over. This file
 * runs inside each worker before any tests execute, ensuring DATABASE_URL and
 * other secrets are available when Prisma initialises.
 */
config({ path: resolve(process.cwd(), ".env"), override: false, quiet: true });
config({
  path: resolve(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});
