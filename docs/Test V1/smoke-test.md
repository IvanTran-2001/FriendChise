# Smoke Test — V1

**Date run:** 2026-04-19
**Tester:** Ivan Tran
**Branch:** master

---

## Legend

✅ PASS &nbsp; ❌ FAIL &nbsp; ⚠️ PARTIAL &nbsp; `[ ]` Not yet tested

---

## Test Run Results

| # | Test | As who | What to check | Status |
|---|------|--------|---------------|--------|
| 1 | Sign in | Account A | Google OAuth works, redirects to org list | ✅ PASS |
| 2 | Create org | Account A | Org appears, owner role auto-assigned | ✅ PASS |
| 3 | Edit org settings | Account A | Name, address, operating days, timezone save correctly | ✅ PASS |
| 4 | Create roles | Account A | "Cook", "Cleaner" with different colors + permissions | ✅ PASS |
| 5 | Create tasks | Account A | "Sweep floor", "Prep station" with eligibility tied to roles | ✅ PASS |
| 6 | Create template | Account A | Weekly template with entries across days | ⚠️ PARTIAL |
| 7 | Apply template | Account A | Pick a start date → timetable populates with entries | ⚠️ PARTIAL |
| 8 | Timetable view | Account A | Switch daily/weekly, entries show with correct times + colors | `[ ]` |
| 9 | Invite member | Account A | Send invite to Account B's email | `[ ]` |
| 10 | Accept invite | Account B | See notification → accept → membership created | `[ ]` |
| 11 | RBAC block | Account B | Try accessing /settings/roles — should be denied (default role, no MANAGE_ROLES permission) | `[ ]` |
| 12 | Franchise invite | Account A | Send franchise token to Account B | `[ ]` |
| 13 | Decline invite | Account B | Decline → status updates, shows in history | `[ ]` |
| 14 | Mobile | Either | Open on phone — check timetable, nav, modals | `[ ]` |

---

## Bugs & Enhancements Found

### All — General

- ⚠️ Web should remember modes (day/week/card/list/simple/calendar/filters) across sessions:
  - Task view (card/list)
  - Timetable view (calendar/simple, day/week)
  - Member view (card/list)
  - Template view (card/list) and editor (calendar/simple, day/week)
- ❌ **Phone scroll glitch** — scrolling to the bottom jumps back to the top, very awkward/glitchy
- ❌ **No-permission toast** — when a user has no permission to access a page, show a toast ("No authorisation" / "Account required") instead of a silent redirect

### Create Franchise / Org

- ❌ **Phone** — input is stretching full width
- ❌ Creator should be both Owner **and** Default Member at the same time
- ❌ Default Member role should have no permissions set — just the name

### Timetable

- ❌ **Phone** — timetable is stretched out in week mode (overflows horizontally)
- ❌ **Phone** — can't add a task when the empty-state screen is showing
- ❌ No date change control on the task edit popup
- ❌ No colour/status feedback when changing task status
- ❌ **Role visibility** — members should only see tasks that match their role. If a task has the "Fryer" role, only members with "Fryer" can see it (exception: anyone with `VIEW_TIMETABLE` permission sees all)

### Tasks

- ❌ No dark shade / press feedback when holding or clicking a task row on mobile
- ❌ Saving after editing a task should redirect back to where the user came from
- ❌ Toolbar buttons should be on the right side
- ❌ **iPhone** — tapping a task block automatically tries to edit the time instead of the status
- ❌ **Phone** — when adding a task to the calendar, the popup appears at the bottom; should be near the top (same issue as notification panel)
- ⚠️ **Create Task — duration input** — consider a scroll/stopwatch-style time input instead of a plain number field
- ⚠️ **Create Task — start time input** — same; scrollable time picker

### Settings / Organisation

- ❌ Content is not centered / no max-width on wide screens

### Notifications

- ❌ **Phone** — notification panel appears at the bottom; should be higher up with a gap at the top and be scrollable
- ❌ Clicking the notification bell should refresh the list in case new notifications have arrived
- ❌ Should send a notification to the inviter when their invitation is accepted

### Create Roles

- ❌ Form inputs blend into the page background — needs visible background/border

### NavBar (Mobile)

- ❌ Pressing "back to org" from Settings should keep/reopen the sidebar for the org section
- ❌ Going from org to Settings should not close the sidebar — or at least reopen it

### Members

- ❌ After editing and saving a membership, redirect back to the viewer profile or list and show a "[User] updated" toast
- ❌ Action dropdown should be removed — replace with inline buttons (Edit + all actions on the right side of the toolbar)
- ❌ Inviting a member without a role should auto-assign the Default Member role (role field should be optional)

### Franchise

- ❌ After an ownership transfer, the receiving user must force-restart the app to see the Franchisee button

### Timetable Templates

- ❌ Very incomplete — needs full parity with the live timetable:
  - Layout is broken on phone
  - Toolbar buttons should all be on the right
  - Needs a ··· menu per template: delete, rename, duplicate
- ❌ **Editor** — missing:
  - Simple / Calendar view mode toggle
  - Day / Week span toggle
  - Task colours on the task sidebar
  - Role filter
  - Should match the timetable calendar exactly
- ❌ Applying a template to past dates should warn the user that existing entries will be replaced and require confirmation

### Settings (Guard / Structure)

- 💡 Consider a catch-all guard on `/orgs/[orgId]/settings/*` — if a user lacks `MANAGE_SETTINGS`, redirect regardless of sub-route so future settings pages are protected automatically

### Guard Pages

- ❌ Timetable templates pages need an auth/permission guard
- 💡 Same catch-all guard pattern as settings could apply to templates
- ❌ Accessing the Franchisee page without permission should redirect to the **org overview**, not the web home page

---

## Permission Reference

| Permission Required | URL | What it does |
|---------------------|-----|--------------|
| `MANAGE_SETTINGS` | `/orgs/{orgId}/settings` | Settings landing |
| `MANAGE_SETTINGS` | `/orgs/{orgId}/settings/organization` | Edit org name, address, hours, timezone |
| `MANAGE_SETTINGS` | `/orgs/{orgId}/settings/notification` | Notification settings |
| `MANAGE_SETTINGS` | `/orgs/{orgId}/settings/timetable` | Timetable display config |
| `MANAGE_ROLES` | `/orgs/{orgId}/settings/roles` | List all roles |
| `MANAGE_ROLES` | `/orgs/{orgId}/settings/roles/new` | Create new role |
| `MANAGE_ROLES` | `/orgs/{orgId}/settings/roles/{roleId}/edit` | Edit existing role |
| `MANAGE_TASKS` | `/orgs/{orgId}/tasks` | List all tasks |
| `MANAGE_TASKS` | `/orgs/{orgId}/tasks/new` | Create new task |
| `MANAGE_TASKS` | `/orgs/{orgId}/tasks/{taskId}/edit` | Edit existing task |
| `MANAGE_MEMBERS` | `/orgs/{orgId}/memberships` | List all members |
| `MANAGE_MEMBERS` | `/orgs/{orgId}/memberships/new` | Invite new member |
| `MANAGE_MEMBERS` | `/orgs/{orgId}/memberships/{memberId}` | View/edit member detail |
| `MANAGE_TIMETABLE` | `/orgs/{orgId}/timetable/templates` | List templates |
| `MANAGE_TIMETABLE` | `/orgs/{orgId}/timetable/templates/new` | Create template |
| `MANAGE_TIMETABLE` | `/orgs/{orgId}/timetable/templates/{templateId}/edit` | Edit template |
| `MANAGE_SETTINGS` | `/orgs/{orgId}/franchisee` | Franchise management |

---

## V2 Notes

- ❌ **Join/create franchise** — input card has no background; inputs blend into the page. Should have a white/card background.
- ❌ **Phone — notification panel** — should have a gap at the top, touch the bottom, and be scrollable even when there are few notifications.
- ❌ **Phone — add task popup** — should appear near the top (with a gap) like the notification panel, touch the bottom, and be scrollable.
- ❌ **Timetable zoom / mobile** — when zoomed in, the calendar overflows and allows horizontal scroll. On mobile it stretches off screen. Fix: as the screen narrows, reduce visible columns — 7 → 3 → 1 (single day mode).
- ❌ **Members view** — Edit, Restrict, Delete buttons should be on the **right** side of the toolbar.
