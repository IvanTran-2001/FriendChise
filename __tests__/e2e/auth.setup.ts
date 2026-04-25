import { test as setup, expect } from "@playwright/test";

/**
 * Playwright auth setup.
 *
 * Runs before any test that depends on the "setup" project.
 * Hits the test-only /api/test/login endpoint (requires TEST_MODE=1),
 * verifies the session works, then saves browser state so authenticated
 * tests can reuse it without logging in again.
 */

// Ivan is the primary test user — owner of Donut Shop A and Coffee House B.
// Primary test user — owner of Walker's Doughnuts.
// Override locally via E2E_TEST_USER_EMAIL if your seed uses a different identity.
const E2E_TEST_USER_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? "ivan@example.test";

// Must match the storageState path in playwright.config.ts
export const AUTH_FILE = "playwright/.auth/ivan.json";

setup("authenticate as Ivan", async ({ page }) => {
  const response = await page.request.get(
    `/api/test/login?email=${encodeURIComponent(E2E_TEST_USER_EMAIL)}`,
  );
  expect(response.ok()).toBeTruthy();

  // Confirm the session is live — app root must not redirect to /signin
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/signin/);

  await page.context().storageState({ path: AUTH_FILE });
});
