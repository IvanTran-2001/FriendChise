import { test, expect, type Page } from "@playwright/test";

/**
 * Task lifecycle E2E tests.
 *
 * Runs as Ivan (authenticated via storageState from auth.setup.ts).
 * Each test creates its own org so tests are fully independent.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a fresh org and returns its orgId. */
async function createOrg(page: Page, orgName: string): Promise<string> {
  await page.goto("/orgs/new");
  await page.getByLabel(/org name/i).fill(orgName);
  await page.getByRole("button", { name: /create organization/i }).click();
  await expect(page).toHaveURL(/\/orgs\/(?!new$|join$)[^/]+$/);

  const url = page.url();
  const orgId = url.match(/\/orgs\/(?!new$|join$)([^/]+)$/)?.[1];
  if (!orgId) throw new Error("Could not extract orgId from URL");
  return orgId;
}

/** Types into the task list search box to filter rows by title. */
async function searchTasks(page: Page, title: string) {
  await page.getByLabel(/search tasks by title/i).fill(title);
}

/**
 * Navigates to the create-task form and waits for React to fully hydrate.
 * `networkidle` fires when JS finishes downloading, but React may not have
 * attached `onSubmit` yet. We wait until the submit button has a React fiber
 * (set during hydration) before the test interacts with the form.
 */
async function gotoNewTask(page: Page, orgId: string) {
  await page.goto(`/orgs/${orgId}/tasks/new`);
  await page.waitForFunction(
    () => {
      const btn = document.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      return (
        btn != null &&
        Object.keys(btn).some((k) => k.startsWith("__reactFiber"))
      );
    },
    { timeout: 30000 },
  );
}

/**
 * After navigating to an edit page, waits for it to fully load.
 * Retries once if the Next.js dev overlay shows a transient "network error"
 * (can occur on the first RSC render when the remote Supabase DB is slow).
 */
async function waitForEditPage(page: Page) {
  await page.waitForLoadState("networkidle");
  // Recover from transient RSC "network error" shown in dev mode overlay
  const errorCount = await page
    .getByRole("dialog", { name: /Runtime TypeError/i })
    .count();
  if (errorCount > 0) {
    await page.reload();
    await page.waitForLoadState("networkidle");
  }
  await page.waitForFunction(
    () => {
      const btn = document.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      return (
        btn != null &&
        Object.keys(btn).some((k) => k.startsWith("__reactFiber"))
      );
    },
    { timeout: 30000 },
  );
}

/**
 * Creates a role via the roles page sidebar → action sidebar form.
 */
async function createRole(page: Page, orgId: string, roleName: string) {
  await page.goto(`/orgs/${orgId}/settings/roles`);
  await page.getByRole("button", { name: /create role/i }).click();
  await page.getByLabel(/name/i).fill(roleName);
  await page
    .getByRole("button", { name: /create role/i })
    .last()
    .click();
  await expect(page.getByRole("cell", { name: roleName })).toBeVisible({
    timeout: 10000,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("create task → appears in task list", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Task Org ${Date.now()}`);
  const taskTitle = `E2E Task ${Date.now()}`;

  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();

  // createTaskAction redirects server-side to the tasks list
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  await searchTasks(page, taskTitle);
  await expect(page.getByText(taskTitle)).toBeVisible();
});

test("edit task → updated title visible in task list and detail", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Edit Task Org ${Date.now()}`);
  const taskTitle = `E2E Edit Task ${Date.now()}`;
  const updatedTitle = `E2E Edited Task ${Date.now()}`;

  // Create task
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to task detail
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+/);
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  // Click Edit
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await waitForEditPage(page);

  // Update title and save
  await page.getByLabel(/title/i).fill(updatedTitle);
  await page.getByRole("button", { name: /save/i }).click();

  // updateTaskAction does a client router.push to task detail
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
});

test("delete task from detail → removed from task list", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Delete Task Org ${Date.now()}`);
  const taskTitle = `E2E Delete Task ${Date.now()}`;

  // Create task
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to detail
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  // Delete via task-actions toolbar
  await page
    .getByTestId("task-actions")
    .getByRole("button", { name: /delete/i })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^delete$/i })
    .click();

  // Client router.push back to tasks list
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  await searchTasks(page, taskTitle);
  await expect(page.getByRole("button").filter({ hasText: taskTitle })).not.toBeVisible();
});

test("delete task from table row menu → removed from task list", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Delete Row Org ${Date.now()}`);
  const taskTitle = `E2E Delete Row Task ${Date.now()}`;

  // Create task
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Open the row menu and click Delete
  await searchTasks(page, taskTitle);
  await page
    .getByRole("button")
    .filter({ hasText: taskTitle })
    .getByRole("button", { name: /task actions/i })
    .click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();

  // Confirm in the AlertDialog
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^delete$/i })
    .click();

  // Table refreshes in place (router.refresh), task is gone
  await expect(page.getByRole("button").filter({ hasText: taskTitle })).not.toBeVisible();
});

test("create task without title → stays on page, does not submit", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Validation Org ${Date.now()}`);

  await gotoNewTask(page, orgId);
  await page.getByRole("button", { name: /create task/i }).click();

  // Browser required-field validation blocks submit
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/new$/);
  await expect(page.getByLabel(/title/i)).toHaveAttribute("required");
});

test("edit task without title → stays on edit page, does not submit", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Edit Validation Org ${Date.now()}`);
  const taskTitle = `E2E Edit Validation Task ${Date.now()}`;

  // Create a task to edit
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await waitForEditPage(page);

  // Clear title and try to save
  await page.getByLabel(/title/i).fill("");
  await page.getByRole("button", { name: /save/i }).click();

  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await expect(page.getByLabel(/title/i)).toHaveAttribute("required");
});

test("create task with role → role badge visible in task list", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Role Task Org ${Date.now()}`);
  const taskTitle = `E2E Role Task ${Date.now()}`;
  const roleName = `E2E Role ${Date.now()}`;

  await createRole(page, orgId, roleName);

  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);

  // Add role via eligibility panel
  await page.getByRole("button", { name: /add role/i }).click();
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();

  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  await searchTasks(page, taskTitle);
  await expect(
    page.getByRole("button").filter({ hasText: taskTitle }).getByText(roleName),
  ).toBeVisible();
});

test("edit task to add role → role badge visible in task list", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Edit Role Org ${Date.now()}`);
  const taskTitle = `E2E Edit Role Task ${Date.now()}`;
  const roleName = `E2E Edit Role ${Date.now()}`;

  await createRole(page, orgId, roleName);

  // Create task without a role
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await waitForEditPage(page);

  // Add role
  await page.getByRole("button", { name: /add role/i }).click();
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();

  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/, {
    timeout: 15000,
  });

  await page.goto(`/orgs/${orgId}/tasks`);
  // Wait for any client-side redirects (e.g. localStorage mode/filter restore) to settle
  await page.waitForLoadState("networkidle");
  await searchTasks(page, taskTitle);
  await expect(
    page.getByRole("button").filter({ hasText: taskTitle }).getByText(roleName),
  ).toBeVisible();
});

test("edit task to remove role → role badge no longer visible in task list", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Remove Role Org ${Date.now()}`);
  const taskTitle = `E2E Remove Role Task ${Date.now()}`;
  const roleName = `E2E Remove Role ${Date.now()}`;

  await createRole(page, orgId, roleName);

  // Create task with the role
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /add role/i }).click();
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await waitForEditPage(page);

  // Remove role via chip × button
  await page.getByRole("button", { name: `Remove ${roleName}` }).click();

  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/, {
    timeout: 15000,
  });

  await page.goto(`/orgs/${orgId}/tasks`);
  // Wait for any client-side redirects (e.g. localStorage mode/filter restore) to settle
  await page.waitForLoadState("networkidle");
  await searchTasks(page, taskTitle);
  // Wait for the task row to appear before asserting the badge is absent
  await expect(
    page.getByRole("button").filter({ hasText: taskTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("button").filter({ hasText: taskTitle }).getByText(roleName),
  ).not.toBeVisible();
});

test("search filter → only matching tasks visible", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Search Org ${Date.now()}`);
  const ts = Date.now();
  const matchTitle = `E2E Search Match ${ts}`;
  const noMatchTitle = `E2E Search Other ${ts}`;

  // Create two tasks
  for (const title of [matchTitle, noMatchTitle]) {
    await gotoNewTask(page, orgId);
    await page.getByLabel(/title/i).fill(title);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });
  }

  await searchTasks(page, matchTitle);
  await expect(page.getByRole("button").filter({ hasText: matchTitle })).toBeVisible();
  await expect(
    page.getByRole("button").filter({ hasText: noMatchTitle }),
  ).not.toBeVisible();
});

test("role filter → only tasks with that role visible", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Filter Org ${Date.now()}`);
  const ts = Date.now();
  const roleName = `E2E Filter Role ${ts}`;
  const taskWithRole = `E2E Filtered Task ${ts}`;
  const taskWithoutRole = `E2E Unfiltered Task ${ts}`;

  await createRole(page, orgId, roleName);

  // Create task with role
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskWithRole);
  await page.getByRole("button", { name: /add role/i }).click();
  await page.getByPlaceholder(/search roles/i).fill(roleName);
  await page.getByRole("button", { name: roleName }).click();
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Create task without role
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskWithoutRole);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Open sidebar role filter dropdown and select the role
  await page.getByRole("button", { name: /filter by role/i }).click();
  await page.getByRole("menuitem", { name: roleName }).click();

  await expect(page.getByRole("button").filter({ hasText: taskWithRole })).toBeVisible();
  await expect(
    page.getByRole("button").filter({ hasText: taskWithoutRole }),
  ).not.toBeVisible();
});

test("task detail → shows correct fields after create", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Detail Org ${Date.now()}`);
  const taskTitle = `E2E Detail Task ${Date.now()}`;
  const description = "This is a test description.";

  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/description/i).fill(description);
  // Duration: 1h 30m
  await page.getByLabel("Hours").selectOption("1");
  await page.getByLabel("Minutes").selectOption("30");
  // People required: 3
  await page.getByLabel(/people required/i).fill("3");
  // Wait days
  await page.getByLabel(/min wait days/i).fill("2");
  await page.getByLabel(/max wait days/i).fill("5");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to detail
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  await expect(page.getByText("1 h 30 min")).toBeVisible();
  await expect(page.getByText("2–5 days")).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  // "People" label is a <p>, followed immediately by the value <p>
  await expect(
    page
      .locator("p")
      .filter({ hasText: /^people$/i })
      .locator("+ p"),
  ).toHaveText("3");
});

test("task detail → shows updated values after edit", async ({ page }) => {
  const orgId = await createOrg(page, `E2E Detail Edit Org ${Date.now()}`);
  const taskTitle = `E2E Detail Edit Task ${Date.now()}`;
  const updatedTitle = `E2E Detail Edited ${Date.now()}`;
  const updatedDescription = "Updated description.";

  // Create task
  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByLabel(/description/i).fill("Original description.");
  await page.getByLabel("Hours").selectOption("1");
  await page.getByLabel("Minutes").selectOption("0");
  await page.getByLabel(/min wait days/i).fill("1");
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Navigate to edit
  await searchTasks(page, taskTitle);
  await page.getByRole("button").filter({ hasText: taskTitle }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();
  await page
    .getByTestId("task-actions")
    .getByRole("link", { name: /edit/i })
    .click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+\/edit$/);
  await waitForEditPage(page);

  // Update fields
  await page.getByLabel(/title/i).fill(updatedTitle);
  await page.getByLabel("Hours").selectOption("2");
  await page.getByLabel("Minutes").selectOption("15");
  await page.getByLabel(/min wait days/i).fill("3");
  await page.getByLabel(/max wait days/i).fill("7");
  // TipTap's ProseMirror pipeline is bypassed by Playwright's fill() and
  // keyboard events in headless mode: the contenteditable DOM is updated but
  // TipTap's onUpdate never fires, so the hidden <input name="description">
  // keeps the old value. Set it directly after all other fields are filled
  // (any earlier and React re-renders from other field changes can overwrite
  // it by re-running TipTap's sync effect).
  await page.evaluate(
    (desc) => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="description"]',
      );
      if (input) input.value = desc;
    },
    updatedDescription,
  );
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/.+(?<!\/edit)$/);

  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await expect(page.getByText("2 h 15 min")).toBeVisible();
  await expect(page.getByText("3–7 days")).toBeVisible();
  await expect(page.getByText(updatedDescription)).toBeVisible();
});

// TODO [bug]: The Duplicate option navigates to tasks/new?duplicateFrom=[taskId]
// but new/page.tsx does not read the searchParam or pass it to TaskForm, so the
// form is blank instead of pre-filled. Unskip and update assertions once implemented.
test.skip("duplicate task → opens new task form with duplicateFrom param", async ({
  page,
}) => {
  const orgId = await createOrg(page, `E2E Duplicate Org ${Date.now()}`);
  const taskTitle = `E2E Duplicate Task ${Date.now()}`;

  await gotoNewTask(page, orgId);
  await page.getByLabel(/title/i).fill(taskTitle);
  await page.getByRole("button", { name: /create task/i }).click();
  await expect(page).toHaveURL(`/orgs/${orgId}/tasks`, { timeout: 15000 });

  // Open the row menu and click Duplicate
  await searchTasks(page, taskTitle);
  await page
    .getByRole("row")
    .filter({ hasText: taskTitle })
    .getByRole("button", { name: /task actions/i })
    .click();
  await page.getByRole("menuitem", { name: /duplicate/i }).click();

  await expect(page).toHaveURL(/\/orgs\/.+\/tasks\/new\?duplicateFrom=.+/);
  await expect(page.getByLabel(/title/i)).toHaveValue("");
});
