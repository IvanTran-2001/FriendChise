import { test, expect } from "@playwright/test";

/**
 * Org lifecycle E2E tests.
 *
 * Runs as Ivan (authenticated via storageState from auth.setup.ts).
 * Each test creates its own org with a unique name so tests are fully
 * independent — no assumptions about seeded data.
 */

const ORG_NAME = `E2E Org ${Date.now()}`;

test("create org → lands on overview → org name visible in navbar", async ({
  page,
}) => {
  await page.goto("/orgs/new");

  // Fill in the org name (the only required field)
  await page.getByLabel(/org name/i).fill(ORG_NAME);

  // Submit
  await page.getByRole("button", { name: /create organization/i }).click();

  // Should redirect to the new org's overview
  await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

  // Org name should appear in the navbar org switcher
  await expect(page.getByRole("button", { name: ORG_NAME })).toBeVisible();
});

test("delete org → redirected to /", async ({ page }) => {
  // Create a dedicated org for this test so deletion doesn't affect others
  const deleteOrgName = `E2E Delete Org ${Date.now()}`;

  await page.goto("/orgs/new");
  await page.getByLabel(/org name/i).fill(deleteOrgName);
  await page.getByRole("button", { name: /create organization/i }).click();
  await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

  // Extract the orgId from the URL
  const url = page.url();
  const orgId = url.match(/\/orgs\/(?!new$|join$)([^/]+)$/)?.[1];
  expect(orgId).toBeTruthy();

  // Navigate to org settings → organization tab
  await page.goto(`/orgs/${orgId}/settings/organization`);

  // Type the org name into the delete confirmation input
  await page.getByPlaceholder(deleteOrgName).fill(deleteOrgName);

  const deleteSection = page.getByTestId("delete-org-section");
  const deleteButton = deleteSection.getByRole("button", {
    name: /delete org/i,
  });
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // Should redirect back to the app root after deletion (hub page)
  await expect(page).toHaveURL("/");
});

test("create org without a name → stays on page, does not submit", async ({
  page,
}) => {
  await page.goto("/orgs/new");

  // Leave the org name blank and try to submit
  await page.getByRole("button", { name: /create organization/i }).click();

  // Should remain on the new org page — no redirect
  await expect(page).toHaveURL("/orgs/new");

  // The input should be flagged as invalid via native HTML5 validation
  await expect(page.getByLabel(/org name/i)).toHaveAttribute("required");
});

test("delete org with wrong name → button stays disabled", async ({ page }) => {
  const deleteOrgName = `E2E Wrong Delete Org ${Date.now()}`;

  await page.goto("/orgs/new");
  await page.getByLabel(/org name/i).fill(deleteOrgName);
  await page.getByRole("button", { name: /create organization/i }).click();
  await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

  const url = page.url();
  const orgId = url.match(/\/orgs\/(?!new$|join$)([^/]+)$/)?.[1];
  expect(orgId).toBeTruthy();

  await page.goto(`/orgs/${orgId}/settings/organization`);

  const deleteSection = page.getByTestId("delete-org-section");
  const deleteButton = deleteSection.getByRole("button", {
    name: /delete org/i,
  });

  // Type a wrong name — button should remain disabled
  await page.getByPlaceholder(deleteOrgName).fill("wrong name");
  await expect(deleteButton).toBeDisabled();

  // Partially correct — still disabled
  await page.getByPlaceholder(deleteOrgName).fill(deleteOrgName.slice(0, -1));
  await expect(deleteButton).toBeDisabled();

  // Should not have navigated away
  await expect(page).toHaveURL(`/orgs/${orgId}/settings/organization`);
});
