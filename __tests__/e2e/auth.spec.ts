import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests.
 *
 * These tests only exercise public routes and middleware — no database
 * queries are made, so they run against the app with any valid env setup.
 */

test("unauthenticated user visiting / is redirected to /signin", async ({
  page,
}) => {
  await page.goto("/");
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
