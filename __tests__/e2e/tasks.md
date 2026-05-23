# E2E Test Documentation — Tasks

> File: `__tests__/e2e/tasks.spec.ts`  
> Runner: Playwright (Chromium), authenticated as Ivan  
> Each test creates its own org so all tests are fully independent.

---

## Helper functions

| Helper                          | Purpose                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createOrg(page, name)`         | Creates a fresh org via `/orgs/new` and returns the `orgId`.                                                                                                                                                                     |
| `gotoNewTask(page, orgId)`      | Navigates to `/orgs/{orgId}/tasks/new` and waits for React to fully mount (`form[data-hydrated]`). Reliable even on cold Turbopack builds.                                                                                       |
| `waitForEditPage(page)`         | After navigating to an edit page, waits for networkidle then checks for the Next.js "Runtime TypeError" dev overlay (transient RSC network error). Reloads once if the overlay is present, then waits for `form[data-hydrated]`. |
| `searchTasks(page, title)`      | Types into the task-list search box to filter rows by title.                                                                                                                                                                     |
| `createRole(page, orgId, name)` | Creates a role via the roles page sidebar "Create Role" button (action sidebar form) and waits for the role to appear in the table.                                                                                              |

---

## Test cases

### 1. `create task → appears in task list`

**What it tests**  
The full create-task happy path: filling the form, submitting, and confirming the new task appears in the list.

**Flow**

1. Navigate to `/tasks/new` (via `gotoNewTask` — ensures React is hydrated)
2. Fill title only (other fields use defaults: 30 min duration, no wait-day override)
3. Click "Create Task"
4. Assert URL redirects to `/orgs/{orgId}/tasks` (server-side `redirect()` from `createTaskAction`)
5. Search for the task title in the list and assert it is visible

**Key assertions**

- Server-side redirect changes URL from `/tasks/new` to `/tasks`
- Task title appears in the table after the redirect

**Notes / potential improvements**

- Could also verify the color dot is rendered with the correct hex value
- Could verify the default duration (30 min) is shown in the row

---

### 2. `edit task → updated title visible in task list and detail`

**What it tests**  
The full edit-task happy path: updating a task's title, confirming the redirect to the detail page, and verifying the updated title is shown.

**Flow**

1. Create task via `gotoNewTask` + form submit
2. Navigate to detail by clicking the task title cell
3. Click the Edit link in the `task-actions` toolbar
4. Wait for edit page to load (`waitForEditPage`)
5. Clear title and fill in new title
6. Click "Save"
7. Assert client-side router navigates to task detail (`/tasks/{id}`, not `/tasks/{id}/edit`)
8. Assert the updated title heading is visible on the detail page

**Key assertions**

- `updateTaskAction` returns `{ok: true}`; the client `useEffect` calls `router.push()` to the detail URL
- The URL regex `(?<!\/edit)$` confirms we are NOT on the edit page
- The `<h1>` on the detail page shows the new title

**Notes / potential improvements**

- Could verify the task list also reflects the updated title (navigate back to list)
- Could verify a "Task saved" toast appeared

---

### 3. `delete task from detail → removed from task list`

**What it tests**  
Deleting a task from its detail page via the confirmation dialog, and confirming the task is gone from the list.

**Flow**

1. Create task
2. Navigate to detail
3. Click "Delete" button in `task-actions` toolbar
4. Confirm the `alertdialog` appears
5. Click the "Delete" confirm button inside the dialog
6. Assert client-side `router.push()` navigates back to `/tasks`
7. Search for the deleted task — assert cell is NOT visible

**Key assertions**

- The AlertDialog must appear before confirming (prevents accidental double-clicks)
- URL changes back to `/tasks` after delete
- Task cell is absent from the table

**Notes / potential improvements**

- Could verify the toast "Task deleted" message appears
- Could assert the task count in the sidebar decrements

---

### 4. `delete task from table row menu → removed from task list`

**What it tests**  
Deleting a task via the row's kebab (⋯) menu on the task list page, and confirming the table refreshes in place.

**Flow**

1. Create task
2. Find the table row by title
3. Click the "Task Actions" button on that row
4. Click "Delete" in the dropdown menu
5. Confirm the AlertDialog
6. Assert the task cell is gone (no URL change expected — `router.refresh()` is called)

**Key assertions**

- The URL does NOT change (stays on `/tasks` — uses `router.refresh()`, not `router.push()`)
- The task row disappears from the table after the in-place refresh

**Notes / potential improvements**

- Could verify that other tasks in the list are still present (regression: not deleting the wrong row)

---

### 5. `create task without title → stays on page, does not submit`

**What it tests**  
Browser-native HTML5 form validation blocks submission when the required title field is empty.

**Flow**

1. Navigate to `/tasks/new` (via `gotoNewTask`)
2. Click "Create Task" without filling the title
3. Assert URL stays at `/tasks/new`
4. Assert title input has the `required` attribute

**Key assertions**

- The HTML `required` attribute on the title input prevents the browser from firing the `submit` event, so `createTaskAction` is never called
- URL remains at `/tasks/new`

**Notes / potential improvements**

- Could verify the browser's native validation tooltip is shown
- Consider testing server-side validation: remove `required` from the input via DevTools and submit — should the action also return a Zod error?

---

### 6. `edit task without title → stays on edit page, does not submit`

**What it tests**  
Same HTML5 validation as above, but on the edit form: clearing the title should block save.

**Flow**

1. Create a task
2. Navigate to edit page
3. Clear the title field
4. Click "Save"
5. Assert URL stays on the edit page
6. Assert title input has `required`

**Key assertions**

- Same browser `required` validation blocks the submit event on the edit form
- URL pattern still matches `.../edit`

**Notes / potential improvements**

- Could test that unsaved edits to other fields (description, duration) are also preserved when validation blocks submit

---

### 7. `create task with role → role badge visible in task list`

**What it tests**  
Creating a task with a role eligibility set and verifying the role badge appears in the task list row.

**Flow**

1. Create a role via `createRole` helper
2. Navigate to `/tasks/new`
3. Click "Add role" → search for the role → select it (role chip appears)
4. Submit the form
5. Assert redirect to `/tasks`
6. Search for the task and assert the role badge text is visible in the row

**Key assertions**

- Selected role IDs are submitted as hidden `<input name="roleIds">` in the form (create mode)
- `createTaskAction` calls `setTaskEligibilities()` with those IDs
- The role badge appears in the table cell for that task

**Notes / potential improvements**

- Could verify that a task created without a role shows "All roles eligible" or no badge
- Could test selecting multiple roles

---

### 8. `edit task to add role → role badge visible in task list`

**What it tests**  
Adding a role eligibility to an existing task via the edit form and confirming it persists in the list.

**Flow**

1. Create a role, then create a task WITHOUT the role
2. Navigate to edit page
3. Click "Add role" in the eligibility panel → search → select the role  
   _(In edit mode, this fires `addEligibilityAction` immediately — no pending state)_
4. Click "Save" → assert redirect to task detail
5. Navigate to `/tasks` and confirm the role badge is in the row

**Key assertions**

- In edit mode, `addEligibilityAction` is called immediately (not held until save)
- The role badge appears in the task list after saving

**Notes / potential improvements**

- Could verify the immediate-save behaviour by checking the role chip is visible without clicking Save
- Could test adding multiple roles in sequence

---

### 9. `edit task to remove role → role badge no longer visible in task list`

**What it tests**  
Removing a role eligibility from an edit form and confirming the badge disappears from the list.

**Flow**

1. Create a role and a task with that role
2. Navigate to edit page
3. Click the "Remove {roleName}" × chip button  
   _(In edit mode, `removeEligibilityAction` fires immediately)_
4. Click "Save" → assert redirect to task detail
5. Navigate to `/tasks` and confirm the role badge is NOT visible for that row

**Key assertions**

- The Remove button's `aria-label` is `"Remove {roleName}"` — used as the selector
- After removal and save, the role badge is absent
- Other rows in the list are unaffected

**Notes / potential improvements**

- Historically, this test was the most fragile due to transient RSC "network error" on the edit page. The `waitForEditPage` helper now handles this with a retry on error.
- Could verify that removing a role doesn't break other eligibilities

---

### 10. `search filter → only matching tasks visible`

**What it tests**  
The task list search box filters rows by title and hides non-matching rows.

**Flow**

1. Create two tasks with distinct titles in the same org
2. Type the first task's title into the search box
3. Assert the first task's cell IS visible
4. Assert the second task's cell is NOT visible

**Key assertions**

- The search filters rows client-side (or via query param) without a page navigation
- Exact title match is visible; non-matching title is hidden

**Notes / potential improvements**

- Could test partial title match
- Could test clearing the search field shows all tasks again
- Could test case-insensitivity

---

### 11. `role filter → only tasks with that role visible`

**What it tests**  
The sidebar "Filter by role" dropdown shows only tasks assigned to the selected role.

**Flow**

1. Create a role
2. Create one task WITH the role, and one WITHOUT
3. Click "Filter by role" button and select the role from the menu
4. Assert the task with the role IS visible
5. Assert the task without the role is NOT visible

**Key assertions**

- The role filter changes the visible rows without a full page reload
- The correct task remains visible; the other is hidden

**Notes / potential improvements**

- Could test clearing the filter brings back all tasks
- Could test filtering by a role that no task has (empty state)
- Could test combining search + role filter

---

### 12. `task detail → shows correct fields after create`

**What it tests**  
After creating a task with specific field values, the detail page renders all fields correctly.

**Flow**

1. Create a task with: title, description, 1h 30m duration, 3 people required, min wait 2 days, max wait 5 days
2. Navigate to detail page by clicking the row
3. Assert heading matches title
4. Assert "1 h 30 min" is visible
5. Assert "2 – 5 days" is visible
6. Assert description text is visible
7. Assert "People required" `<dd>` contains "3"

**Key assertions**

- Duration is displayed in human-readable `"X h Y min"` format
- Wait days shown as `"min – max days"` range
- `<dt>` + `<dd>` structure for people-required field

**Notes / potential improvements**

- Could assert the color swatch renders with the correct hex value
- Could assert the preferred start time if one is set
- Could test boundary values (min duration = 5 min, max wait = 3650 days)

---

### 13. `task detail → shows updated values after edit`

**What it tests**  
After editing a task, the detail page reflects all updated values.

**Flow**

1. Create a task with some initial values
2. Navigate to edit, update title, description, duration (2h 15m), min/max wait days (3–7)
3. Save → assert redirect to detail
4. Assert all updated values are visible on the detail page

**Key assertions**

- All 4 updated fields (title, description, duration, wait days) are reflected on the detail page
- The URL resolves to the task detail, not the edit page

**Notes / potential improvements**

- Could also assert the old values are NOT visible to catch partial-update bugs
- Could test that `updatedAt` timestamp changes (if shown on the page)

---

### 14. `duplicate task → opens new task form with duplicateFrom param` _(SKIPPED)_

**Why it's skipped**  
Known bug: the "Duplicate" row action navigates to `/tasks/new?duplicateFrom={taskId}` but `new/page.tsx` does not read the `duplicateFrom` search param or pre-fill the form.

**What it should test** (once the bug is fixed)

1. Click "Duplicate" in the row actions menu
2. Assert URL contains `tasks/new?duplicateFrom={taskId}`
3. Assert the form is pre-filled with the original task's values (title, description, duration, etc.)

**Key assertions to add when unblocking**

- `page.getByLabel(/title/i)` should have the original task's title as its value
- Other fields should match the source task

---

## Technical notes

### Hydration and cold-start reliability

The `gotoNewTask` helper waits for `form[data-hydrated]` rather than `networkidle`. This attribute is set by a `useEffect` in `TaskForm` after React fully mounts. It prevents the race condition where the test clicks "Create Task" before React has attached the `onSubmit` handler (which causes a native HTML GET form submit back to `/tasks/new` instead of firing the server action).

### Edit-page RSC flakiness

The `waitForEditPage` helper catches the Next.js dev overlay "Runtime TypeError: network error" that occasionally appears when the edit page's React Server Component fetch times out against the remote Supabase database. On encountering it, the helper reloads the page once and tries again.

### Test isolation

Every test creates its own org. This means:

- Tests can run in parallel without data collisions
- Each org has its own namespace of tasks, roles, and members
- The global setup re-seeds the dev database once before the full suite runs

### Server action navigation patterns

| Action                      | Navigation type           | URL change                    |
| --------------------------- | ------------------------- | ----------------------------- |
| `createTaskAction`          | Server `redirect()`       | `/tasks/new` → `/tasks`       |
| `updateTaskAction`          | Client `router.push()`    | `.../edit` → `.../tasks/{id}` |
| `deleteTaskAction` (detail) | Client `router.push()`    | `.../tasks/{id}` → `/tasks`   |
| `deleteTaskAction` (row)    | Client `router.refresh()` | stays on `/tasks`             |
