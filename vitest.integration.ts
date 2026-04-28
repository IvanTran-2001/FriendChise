import { defineConfig } from "vitest/config";

/**
 * Vitest config for integration tests.
 *
 * Integration tests run against the real dev database (seeded fresh before
 * each run). They test service functions end-to-end through Prisma without
 * mocks — verifying real DB constraints, transactions, and relationships.
 *
 * Run with: pnpm test:integration
 *
 * IMPORTANT: This seeds and dirties the dev database. Do not run against
 * production. The global setup reseeds before every run so leftover data
 * from a previous failed run is always cleaned up.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/integration/**/*.test.ts"],
    globalSetup: "__tests__/integration/global.setup.ts",
    setupFiles: ["__tests__/integration/setup.ts"],
    // Run all tests sequentially in a single worker to avoid concurrent
    // writes causing flaky results. DB state is shared across tests.
    pool: "forks",
    maxWorkers: 1,
    // Real DB calls are slower than mocked unit tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
