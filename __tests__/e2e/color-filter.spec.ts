import { test, expect } from "@playwright/test";
import { TEST_RUN_NAMESPACE } from "@/lib/test-run-namespace";

const ORG_NAME = `E2E [${TEST_RUN_NAMESPACE}] Filter Org ${Date.now()}`;
const TEMPLATE_NAME = `E2E Template ${Date.now()}`;

test("preserve color filter state in template mode", async ({ page }) => {
  // 1. Create org
  await page.goto("/orgs/new");
  await page.getByLabel(/org name/i).fill(ORG_NAME);
  await page.getByRole("button", { name: /create organization/i }).click();
  await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

  const url = page.url();
  const orgId = url.match(/\/orgs\/(?!new$|join$)([^/]+)$/)?.[1];
  expect(orgId).toBeTruthy();

  // 2. Go to templates
  await page.goto(`/orgs/${orgId}/timetable/templates`);

  // 3. Create a template
  await page.getByRole("button", { name: /New Template/i }).click();
  await page.getByLabel(/Name/i).fill(TEMPLATE_NAME);
  await page.getByRole("button", { name: /Create & Edit Template/i }).click();

  // 4. Verify redirected to template editor
  await expect(page).toHaveURL(new RegExp(`/orgs/${orgId}/timetable/templates/[^/]+`));

  // 5. Locate color filter button and change to 'Color by Role'
  const filterBtn = page.getByRole("button", { name: "Color filter" });
  await expect(filterBtn).toBeVisible();
  await expect(filterBtn).toHaveText(/Color by Task/i);

  await filterBtn.click();
  const roleOption = page.getByRole("menuitem", { name: /Color by Role/i });
  await expect(roleOption).toBeVisible();
  await roleOption.click();

  // Color filter button should update
  await expect(filterBtn).toHaveText(/Color by Role/i);

  // 6. Click 'Add day' button to trigger a server-side action and router.refresh()
  const addDayBtn = page.getByRole("button", { name: "Add day" });
  await expect(addDayBtn).toBeVisible();
  await addDayBtn.click();

  // 7. Verify color filter state is preserved and NOT reset
  await expect(filterBtn).toHaveText(/Color by Role/i);

  // 8. Cleanup: Delete organization
  await page.goto(`/orgs/${orgId}/settings/organization`);
  await page.getByPlaceholder(ORG_NAME).fill(ORG_NAME);
  const deleteSection = page.getByTestId("delete-org-section");
  const deleteButton = deleteSection.getByRole("button", { name: /delete org/i });
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();
  await expect(page).toHaveURL("/");
});
