import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__/e2e",
  globalSetup: "./__tests__/e2e/global.setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI: 1 worker (sequential, stable). Local: cap at 3 — the Next.js dev server
  // can't handle more concurrent server actions without non-deterministic errors.
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // 1. Run auth.setup.ts first to log in and save session state
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    // 2. All other tests run as Ivan (authenticated) by default.
    //    Tests that need to be unauthenticated call:
    //      test.use({ storageState: { cookies: [], origins: [] } });
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/ivan.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // TEST_MODE=1 enables the /api/test/login endpoint in the dev server
    command: "pnpm dev",
    env: { TEST_MODE: "1" },
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
