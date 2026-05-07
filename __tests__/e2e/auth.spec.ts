import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests.
 *
 * These tests exercise public/unauthenticated routes. The storageState from
 * auth.setup.ts is cleared here so the tests run as a signed-out user.
 */

// Clear the session from auth.setup.ts — these tests must be unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated user visiting / is redirected to /signin", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);
});

test("unauthenticated user visiting a nested org page is redirected to /signin", async ({
  page,
}) => {
  await page.goto("/orgs/some-id/timetable");
  await expect(page).toHaveURL(/\/signin/);
});

test("sign-in page renders with Continue with Google button", async ({
  page,
}) => {
  await page.goto("/signin");
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test.describe("authenticated", () => {
  test.use({ storageState: "playwright/.auth/ivan.json" });

  test("authenticated user visiting / lands on the hub page", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/signin/);
    await expect(page).toHaveURL("/");
  });
});
