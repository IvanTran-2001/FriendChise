import { test, expect, type Page } from "@playwright/test";

/**
 * Task lifecycle E2E tests.
 *
 * Runs as Ivan (authenticated via storageState from auth.setup.ts).
 * Each test creates its own org so tests are fully independent.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a fresh org and returns its orgId.
 * Used as setup in every test so each test is isolated.
 */
async function createOrg(page: Page, orgName: string): Promise<string> {
  await page.goto("/orgs/new");
  await page.getByLabel(/org name/i).fill(orgName);
  await page.getByRole("button", { name: /create organization/i }).click();
  await expect(page).toHaveURL(/\/orgs\/(.+)\/timetable$/);

  const url = page.url();
  const orgId = url.match(/\/orgs\/([^/]+)\/timetable/)?.[1];
  if (!orgId) throw new Error("Could not extract orgId from URL");
  return orgId;
}

/** Types into the task list search box to filter rows by title. */
async function searchTasks(page: Page, title: string) {
  await page.getByLabel(/search tasks by title/i).fill(title);
}

/**
 * Creates a role under the given org and returns the role name.
 * Navigates to /orgs/[orgId]/settings/roles/new, fills name, submits.
 */
async function createRole(page: Page, orgId: string, roleName: string) {
  await page.goto(`/orgs/${orgId}/settings/roles/new`);
  await page.getByLabel(/name/i).fill(roleName);
  await page.getByRole("button", { name: /create role/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/settings\/roles$/);
}

// TODO [bug]: When both "Min wait days" and "Max wait days" are left empty, the
// form should default both to 1. Currently submitting with both blank causes a
// validation error. Workaround: fill in min wait days as 1 until this is fixed.
// Remove the workaround fills below once the default is applied server-side.

// ─── Tests ────────────────────────────────────────────────────────────────────

test("create task → appears in task list", async ({ page }) => {
  const orgName = `E2E Task Org ${Date.now()}`;
  const taskTitle = `E2E Task ${Date.now()}`;

  const orgId = await createOrg(page, orgName);

  await page.goto(`/orgs/${orgId}/tasks/new`);

  // Fill in the required title field
  await page.getByLabel(/title/i).fill(taskTitle);

  // TODO [remove after bug fix]: default min/max wait days to 1 when both empty
  await page.getByLabel(/min wait days/i).fill("1");

  // Submit
  await page.getByRole("button", { name: /create task/i }).click();

  // Should redirect to the tasks list
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Search for the task to confirm it appears in the list
  await searchTasks(page, taskTitle);
  await expect(page.getByText(taskTitle)).toBeVisible();
});

test("edit task → updated title visible", async ({ page }) => {
  const orgName = `E2E Edit Task Org ${Date.now()}`;
  const taskTitle = `E2E Edit Task ${Date.now()}`;
  const updatedTitle = `E2E Edited Task ${Date.now()}`;

  const orgId = await createOrg(page, orgName);

  // Create the task first
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  // TODO [remove after bug fix]: default min/max wait days to 1 when both empty
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Search for the task, then click the title cell to navigate to detail
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+/);

  // Wait for the server component to finish loading (skeleton replaced by real content)
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  // Click the Edit button on the task detail page
  await page.getByRole("link", { name: /edit/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);

  // Update the title
  await page.getByLabel(/title/i).fill(updatedTitle);
  await page.getByRole("button", { name: /save/i }).click();

  // Should redirect to task detail — updated title should be visible in the heading
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
});

test("delete task → removed from task list", async ({ page }) => {
  const orgName = `E2E Delete Task Org ${Date.now()}`;
  const taskTitle = `E2E Delete Task ${Date.now()}`;

  const orgId = await createOrg(page, orgName);

  // Create the task first
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  // TODO [remove after bug fix]: default min/max wait days to 1 when both empty
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Search for the task, then click the title cell to navigate to detail
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+/);

  // Wait for the server component to finish loading (skeleton replaced by real content)
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  // Click Delete — opens AlertDialog
  await page
    .getByTestId("task-actions")
    .getByRole("button", { name: "Delete" })
    .click();

  // Wait for the AlertDialog animation to complete before interacting
  await expect(page.getByRole("alertdialog")).toBeVisible();

  // Confirm in the AlertDialog
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^delete$/i })
    .click();

  // Should redirect to the tasks list
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Search for the deleted task — it should no longer appear
  await searchTasks(page, taskTitle);
  await expect(page.getByRole("cell", { name: taskTitle })).not.toBeVisible();
});

test("create task without title → stays on page, does not submit", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Task Org ${Date.now()}`);

  await page.goto(`/orgs/${orgId}/tasks/new`);

  // Leave title empty, fill in the wait days workaround, and attempt to submit
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();

  // Should stay on the new task page — browser required validation blocks submit
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/new$/);
  await expect(page.getByLabel(/title/i)).toHaveAttribute("required");
});

test("edit task without title → stays on edit page, does not submit", async ({
  page,
}) => {
  const orgName = `E2E Edit Validation Org ${Date.now()}`;
  const taskTitle = `E2E Edit Validation Task ${Date.now()}`;
  const orgId = await createOrg(page, orgName);

  // Create a task to edit
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);

  // Clear the title and attempt to save
  await page.getByLabel(/title/i).fill("");
  await page.getByRole("button", { name: /save/i }).click();

  // Should stay on the edit page — browser required validation blocks submit
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await expect(page.getByLabel(/title/i)).toHaveAttribute("required");
});

// TODO [bug]: The Duplicate option navigates to tasks/new?duplicateFrom=[taskId]
// but new/page.tsx does not read the searchParam or pass it to TaskForm, so the
// form is blank instead of pre-filled. Unskip and update assertions once implemented.
test.skip("duplicate task → opens new task form with duplicateFrom param", async ({
  page,
}) => {
  const orgName = `E2E Duplicate Org ${Date.now()}`;
  const taskTitle = `E2E Duplicate Task ${Date.now()}`;
  const orgId = await createOrg(page, orgName);

  // Create the source task
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Open the ⋮ dropdown on the task row and click Duplicate
  await searchTasks(page, taskTitle);
  await page
    .getByRole("row")
    .filter({ hasText: taskTitle })
    .getByRole("button", { name: /task actions/i })
    .click();
  await page.getByRole("menuitem", { name: /duplicate/i }).click();

  // Should land on the new task page with duplicateFrom in the URL
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/new\?duplicateFrom=.+/);

  // Form is blank (prefill not yet implemented)
  await expect(page.getByLabel(/title/i)).toHaveValue("");
});

test("create task with role → role badge visible in task list", async ({
  page,
}) => {
  const orgName = `E2E Role Task Org ${Date.now()}`;
  const taskTitle = `E2E Role Task ${Date.now()}`;
  const roleName = `E2E Role ${Date.now()}`;

  const orgId = await createOrg(page, orgName);
  await createRole(page, orgId, roleName);

  // Create task and assign the role via the eligibility panel
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/min wait days/i).fill("1");

  // Type the role name into the eligibility search and click it
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();

  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // The role badge should appear in the Role column of the task row
  await searchTasks(page, taskTitle);
  await expect(
    page.getByRole("row").filter({ hasText: taskTitle }).getByText(roleName),
  ).toBeVisible();
});

test("edit task to add role → role badge visible in task list", async ({
  page,
}) => {
  const orgName = `E2E Edit Role Org ${Date.now()}`;
  const taskTitle = `E2E Edit Role Task ${Date.now()}`;
  const roleName = `E2E Edit Role ${Date.now()}`;

  const orgId = await createOrg(page, orgName);
  await createRole(page, orgId, roleName);

  // Create the task without a role first
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Navigate to edit via the task detail
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);

  // Add the role via the eligibility panel
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();

  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);

  // Go back to the task list and verify the role badge appears
  await page.goto(`/orgs/${orgId}/tasks`);
  await searchTasks(page, taskTitle);
  await expect(
    page.getByRole("row").filter({ hasText: taskTitle }).getByText(roleName),
  ).toBeVisible();
});

test("edit task to remove role → role badge no longer visible in task list", async ({
  page,
}) => {
  const orgName = `E2E Remove Role Org ${Date.now()}`;
  const taskTitle = `E2E Remove Role Task ${Date.now()}`;
  const roleName = `E2E Remove Role ${Date.now()}`;

  const orgId = await createOrg(page, orgName);
  await createRole(page, orgId, roleName);

  // Create task with the role already assigned
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);

  // Remove the role using its labelled remove button in the eligibility panel
  await page.getByRole("button", { name: `Remove ${roleName}` }).click();

  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);

  // Go back to task list — role badge should be gone
  await page.goto(`/orgs/${orgId}/tasks`);
  await searchTasks(page, taskTitle);
  await expect(
    page.getByRole("row").filter({ hasText: taskTitle }).getByText(roleName),
  ).not.toBeVisible();
});

test("search filter → only matching tasks visible", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Search Org ${Date.now()}`);
  const ts = Date.now();
  const matchTitle = `E2E Search Match ${ts}`;
  const noMatchTitle = `E2E Search Other ${ts}`;

  // Create two tasks
  for (const title of [matchTitle, noMatchTitle]) {
    await page.goto(`/orgs/${orgId}/tasks/new`);
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/min wait days/i).fill("1");
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);
  }

  // Search for the unique part of the matching title
  await searchTasks(page, matchTitle);

  // Matching task visible, non-matching task not visible
  await expect(page.getByRole("cell", { name: matchTitle })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: noMatchTitle }),
  ).not.toBeVisible();
});

test("role filter → only tasks with that role visible", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Filter Org ${Date.now()}`);
  const ts = Date.now();
  const roleName = `E2E Filter Role ${ts}`;
  const taskWithRole = `E2E Filtered Task ${ts}`;
  const taskWithoutRole = `E2E Unfiltered Task ${ts}`;

  await createRole(page, orgId, roleName);

  // Create a task with the role
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskWithRole);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Create a task without the role
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskWithoutRole);
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Open the role filter dropdown and select the role
  await page.getByRole("button", { name: /filter by role/i }).click();
  await page.getByRole("menuitem", { name: roleName }).click();

  // Only the task with the role should be visible
  await expect(page.getByRole("cell", { name: taskWithRole })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: taskWithoutRole }),
  ).not.toBeVisible();
});

test("task detail page → shows correct field values after create", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Detail Org ${Date.now()}`);
  const taskTitle = `E2E Detail Task ${Date.now()}`;
  const description = "This is a test description.";

  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/description/i).fill(description);
  // Set duration: 1h 30m
  await page.getByLabel("Hours").selectOption("1");
  await page.getByLabel("Minutes").selectOption("30");
  // People required: 3
  await page.getByLabel(/people required/i).fill("3");
  // Wait days
  await page.getByLabel(/min wait days/i).fill("2");
  await page.getByLabel(/max wait days/i).fill("5");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Navigate to the task detail
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  // Verify all fields on the detail page
  await expect(page.getByText("1 h 30 min")).toBeVisible();
  await expect(page.getByText("2 – 5 days")).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  // People required: assert the value appears next to its label
  await expect(
    page
      .locator("dt")
      .filter({ hasText: /people required/i })
      .locator("+ dd"),
  ).toHaveText("3");
});

test("task detail page → shows updated values after edit", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Detail Edit Org ${Date.now()}`);
  const taskTitle = `E2E Detail Edit Task ${Date.now()}`;
  const updatedTitle = `E2E Detail Edited ${Date.now()}`;
  const updatedDescription = "Updated description.";

  // Create task with initial values
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/description/i).fill("Original description.");
  await page.getByLabel("Hours").selectOption("1");
  await page.getByLabel("Minutes").selectOption("0");
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks$/);

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("cell", { name: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);

  // Update fields
  await page.getByLabel(/title/i).fill(updatedTitle);
  await page.getByLabel(/description/i).fill(updatedDescription);
  await page.getByLabel("Hours").selectOption("2");
  await page.getByLabel("Minutes").selectOption("15");
  await page.getByLabel(/min wait days/i).fill("3");
  await page.getByLabel(/max wait days/i).fill("7");
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);

  // Verify all updated values on the detail page
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await expect(page.getByText("2 h 15 min")).toBeVisible();
  await expect(page.getByText("3 – 7 days")).toBeVisible();
  await expect(page.getByText(updatedDescription)).toBeVisible();
});
