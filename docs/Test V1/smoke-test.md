# Smoke Test — V1

Manual smoke test covering all feature areas of FriendChise.
Run against the production/staging environment after each major release.

**Date last run:** —
**Tester:** —
**Branch / commit:** —
**Pass / Fail:** — / —

---

## Legend

- `[ ]` Not yet tested
- `[x]` Pass
- `[!]` Fail — add note below the item

---

## 1. Authentication

- [ ] Visiting any `/orgs/*` route while signed out redirects to `/signin`
- [ ] Google OAuth sign-in flow completes and redirects to home
- [ ] Signing out clears the session and redirects to `/signin`
- [ ] Returning user (existing account) is recognised and does not create a duplicate user

---

## 2. Organisation — Create & Home

- [ ] `/orgs/new` renders the create org form
- [ ] Submitting the form with a valid name creates the org, bootstraps Owner + Default Member roles, and redirects to the org overview
- [ ] Creator appears in the members list with the Owner role
- [ ] Org overview page loads without error

---

## 3. Navigation

### Sidebar
- [ ] Sidebar renders the correct nav items for the current org
- [ ] Active nav item is highlighted
- [ ] Sidebar collapses / expands on desktop
- [ ] Sidebar closes after navigation on mobile
- [ ] Sidebar re-opens correctly after navigating between org and settings pages (mobile)

### Org switcher
- [ ] Dropdown shows all orgs the user belongs to
- [ ] Selecting an org navigates to that org's overview

### Breadcrumb
- [ ] Breadcrumb updates correctly for each route
- [ ] Dynamic segments (task name, member name, role name, template name) are resolved to human-readable names

---

## 4. Member Management

### List
- [ ] Members list page loads and shows all org members
- [ ] Search filters by name in real time
- [ ] Role filter dropdown narrows the list to members with that role
- [ ] Card / List view toggle works and preference persists after page reload
- [ ] Fixed toolbar stays at the top when the list is long enough to scroll

### Invite
- [ ] "+ Add Member" navigates to the invite form
- [ ] Submitting a valid email sends an invite and shows a success toast
- [ ] Inviting with no role auto-assigns the Default Member role
- [ ] Duplicate pending invite is rejected with an error

### View
- [ ] Member detail page shows avatar, name, email, roles, working days, status, join date
- [ ] Edit and Restrict/Delete actions appear only for users with `MANAGE_MEMBERS`

### Edit
- [ ] Edit form pre-fills current working days and roles
- [ ] Saving redirects back to the member detail page with a confirmation toast
- [ ] Owner role is not shown in the role picker
- [ ] Attempting to assign the owner role via direct form manipulation is rejected

### Restrict / Unrestrict
- [ ] Restrict button shows confirmation dialog; confirming sets status to `RESTRICTED`
- [ ] Unrestrict button sets status back to `ACTIVE`

### Delete
- [ ] Delete button shows confirmation dialog; confirming removes the member
- [ ] Deleting an owner is prevented

---

## 5. Role Management

### List
- [ ] Roles list shows all org roles with color swatches
- [ ] System roles (Owner, Default Member) show a `system` badge
- [ ] System roles cannot be deleted; Owner cannot be edited

### Create
- [ ] Create role form renders with name, color picker, permission checkboxes, task eligibility picker
- [ ] Submitting a valid form creates the role and redirects to the roles list
- [ ] Color is required — submitting without one shows a validation error

### Edit
- [ ] Edit form pre-fills all existing values
- [ ] Saving updates the role without changing its `key`

### Delete
- [ ] Deleting a custom role shows a confirmation dialog
- [ ] After deletion the role disappears from the list and from all member badges

### Security
- [ ] Task eligibility only accepts `taskId`s that belong to the current org (cross-tenant IDs are rejected)

---

## 6. Task Management

### List
- [ ] Tasks list loads with name, color swatch, duration, eligible roles
- [ ] Search filters by name
- [ ] Sort by name / duration / eligible people works
- [ ] Role filter narrows the list
- [ ] Fixed toolbar stays pinned when list is long enough to scroll
- [ ] Row hover shows ··· menu; tapping row on mobile shows active highlight

### Create
- [ ] "New task" form renders with name, color picker, duration, description, role eligibility
- [ ] Color is required — submitting without one shows a validation error
- [ ] Successful create adds the task to the list

### Edit
- [ ] Edit form pre-fills all fields including color
- [ ] Saving redirects back to where the user came from with a success toast

### Detail
- [ ] Clicking a task name (list or timetable) navigates to the task detail page
- [ ] Detail page shows all task fields

### Delete
- [ ] Delete from ··· menu shows a confirmation dialog
- [ ] After deletion task is removed from list

### Duplicate
- [ ] Duplicate from ··· menu creates a copy with "Copy of …" name

---

## 7. Timetable

### Views
- [ ] Calendar view renders with time slots and task blocks for the current week
- [ ] Simple (table) view renders with task rows grouped by day
- [ ] View toggle switches between modes and preference persists after reload

### Navigation
- [ ] Prev / Next arrows move the week correctly
- [ ] Clicking a task name in Calendar view navigates to the task detail page
- [ ] Clicking a task name cell in Simple view navigates to the task detail page; clicking elsewhere opens the edit popup

### Role filter
- [ ] Filter dropdown appears in toolbar
- [ ] Selecting a role narrows the view to tasks eligible for that role
- [ ] Filter persists when navigating weeks (URL param `?roleId=`)

### Status colours
- [ ] TODO tasks show gray
- [ ] IN_PROGRESS tasks show amber
- [ ] DONE tasks show green
- [ ] SKIPPED tasks show red
- [ ] TODO tasks whose date is before today (org timezone) display as SKIPPED without mutating the DB

### Edit popup (···)
- [ ] Clicking ··· on a task block opens the edit dialog
- [ ] All members can update the task status
- [ ] `MANAGE_TIMETABLE` holders additionally see time input, assignee list, and Delete button
- [ ] Changing status updates immediately and the colour changes to match
- [ ] Changing time saves and the block moves
- [ ] Deleting an entry removes it from the grid

### Drag (Calendar mode, desktop)
- [ ] Dragging a task from the side panel onto the grid creates a new entry
- [ ] Dragging an existing entry moves it to the new time/day
- [ ] Entries cannot be dropped outside operating hours

### Mobile
- [ ] "+" button (or sheet trigger) opens the task list panel from the bottom
- [ ] Tapping a task places it on the timetable
- [ ] Tapping a block opens the status panel (not the time editor) by default
- [ ] Week view does not overflow horizontally on a phone
- [ ] Add-task sheet opens from the top with a gap and is scrollable

---

## 8. Template Management

### List
- [ ] Templates list page loads and shows all templates (card and list view)
- [ ] View toggle works and preference persists after reload
- [ ] Each template shows name, cycle length, entry count

### Create
- [ ] "+ New template" navigates to the create form
- [ ] Submitting a valid name and cycle length creates the template and redirects to its editor

### Rename
- [ ] Rename from ··· dropdown opens a dialog with the current name pre-filled
- [ ] Saving updates the name on the list immediately

### Duplicate
- [ ] Duplicate creates a copy named "Copy of <original>"
- [ ] If "Copy of <original>" already exists, suffix "(2)", "(3)" etc. is used

### Delete
- [ ] Delete from ··· dropdown shows a confirmation dialog
- [ ] Confirming removes the template from the list

### Apply template
- [ ] "Apply template" dialog opens from the timetable Actions dropdown
- [ ] Selecting a template, start date, and repeats shows the entry count that will be created
- [ ] Applying replaces existing entries in the date range and shows a success toast with the count of created entries
- [ ] Warning shown if the start date is in the past (#94)

---

## 9. Template Editor

### Calendar mode
- [ ] Time grid renders with the correct number of days (cycle length)
- [ ] Column count adapts to container width via ResizeObserver
- [ ] Tasks are draggable from the task panel onto the grid
- [ ] Existing entries can be dragged to a new time/day
- [ ] Clicking an entry opens the edit popup (start time + assignees)
- [ ] Task panel opens in a bottom sheet on mobile

### Simple mode
- [ ] Day-by-day table shows entries sorted by start time
- [ ] Clicking a row opens the edit popup
- [ ] Task color dot is shown next to the task name

### Navigation
- [ ] Day / Week span toggle works
- [ ] Prev / Next buttons page through the cycle
- [ ] "Start" button jumps to day 1
- [ ] Current day range is shown in the nav label

### Cycle length controls
- [ ] "+" adds a day; template days counter increments
- [ ] "−" removes a day; blocked with an error if entries exist on the last day

### Edit popup
- [ ] Start time input updates the entry start time
- [ ] End time preview updates automatically based on task duration
- [ ] Assignees can be added from the member dropdown
- [ ] Assignees can be removed with the × button

---

## 10. Notification System

### Bell
- [ ] Bell shows a red badge count for unseen invites
- [ ] Clicking the bell marks all invites as seen; badge disappears
- [ ] Bell opens a Popover on desktop and a bottom Sheet on mobile
- [ ] Sheet has a top gap, touches the bottom, and is scrollable on mobile

### Invite cards
- [ ] Member invite cards show org name, inviter name, and Accept / Decline buttons
- [ ] Franchise invite cards show the same and a Join button
- [ ] Accepting a member invite adds the user to the org
- [ ] Declining marks the invite as DECLINED
- [ ] Handled invites (ACCEPTED/DECLINED) remain visible for 7 days then disappear

---

## 11. Franchise Management

### Franchisor
- [ ] Franchisee page is visible only to owners of orgs with no parent
- [ ] "Generate token" creates a `FranchiseToken` with an expiry date and invitee email
- [ ] Token list shows all pending tokens
- [ ] Token can be extended or revoked
- [ ] Franchisee org list shows all child orgs

### Franchisee join
- [ ] `/orgs/new` accept-token flow accepts a valid token and creates the new org
- [ ] Roles, tasks, and timetable settings are cloned from the parent
- [ ] Joining user is set as the new org's Owner
- [ ] Expired or already-used tokens are rejected

### Navigation after join
- [ ] Franchisee org appears in the org switcher immediately after joining
- [ ] Franchisee sidebar button appears for the parent org owner without needing to restart the app

---

## 12. Settings

### Organisation
- [ ] Settings page redirects to `/settings/organization`
- [ ] Org name, timezone, operating hours can be edited and saved
- [ ] Content is centered / max-width constrained on wide screens

### Ownership transfer
- [ ] Transfer ownership form is visible only to the current owner
- [ ] Transferring ownership reassigns the Owner role and demotes the previous owner

### Delete org
- [ ] Delete org requires confirmation (type the org name)
- [ ] Deleting removes the org and redirects to home

### Roles settings
- [ ] `/settings/roles` lists all roles
- [ ] Links to create / edit role pages work

---

## 13. RBAC / Permission Gates

- [ ] Member without `MANAGE_MEMBERS` cannot see invite / edit / delete member buttons
- [ ] Member without `MANAGE_TASKS` cannot see create / edit / delete task buttons
- [ ] Member without `MANAGE_TIMETABLE` cannot drag entries or access the edit time/assignees/delete section of the edit popup
- [ ] Member without `MANAGE_ROLES` cannot access `/settings/roles` (redirect or 403)
- [ ] Member without `MANAGE_SETTINGS` cannot access `/settings/organization` (redirect or 403)
- [ ] Non-member visiting any `/orgs/[orgId]/*` route is redirected
- [ ] Direct URL manipulation with a valid `taskId` from another org is rejected

---

## 14. Open Issues (Known Failing)

These are tracked bugs / enhancements not yet resolved at the time of this test run.

| # | Title | State |
|---|-------|-------|
| [#100](https://github.com/IvanTran-2001/FriendChise/issues/100) | Member detail toolbar actions should be on the right | OPEN |
| [#99](https://github.com/IvanTran-2001/FriendChise/issues/99) | Timetable calendar should adapt column count to screen width | OPEN |
| [#98](https://github.com/IvanTran-2001/FriendChise/issues/98) | Mobile add-task popup: top gap, touch bottom, scrollable | OPEN |
| [#97](https://github.com/IvanTran-2001/FriendChise/issues/97) | Mobile notification panel: top gap, touch bottom, scrollable | OPEN |
| [#94](https://github.com/IvanTran-2001/FriendChise/issues/94) | Warn before applying template to past dates | OPEN |
| [#93](https://github.com/IvanTran-2001/FriendChise/issues/93) | Timetable templates — feature parity with live timetable | OPEN |

---

## Notes / Observations

<!-- Add any observations, edge cases found, or environment-specific issues here -->
