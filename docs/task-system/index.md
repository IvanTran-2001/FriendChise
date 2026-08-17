---
title: Task System
description: Task definitions, timetable scheduling, and how they're gated by permissions
order: 7
---

Following the project's [Services and Actions](/doc/backend-api/services-and-actions) split: task/timetable mutations are usually validated and authorized in `app/actions/*`, though API route handlers such as `app/api/orgs/[orgId]/tasks/*` and the mobile tool routes also perform request validation and authorization. The actual database work stays in `lib/services/*`.

Tasks and the timetable are the operational core of FriendChise — this is how a location's daily work gets defined, scheduled, and tracked.

## Core model

- **`Task`** — a reusable task definition (title, description, tags, optional image) that belongs to an org.
- **`TimetableEntry`** — a scheduled occurrence of work on the calendar. See [Time Model](/doc/task-system/time-model) for how times are stored (UTC) vs. displayed (org timezone).
- **`TimetableTemplate`** — a reusable schedule pattern that can be stamped onto the live timetable, so a recurring week doesn't need to be rebuilt from scratch.
- **`TimetableSettings`** — per-org display settings (e.g. the org's configured timezone) that the timetable UI and time-conversion helpers read from.

## Scope and visibility

- Tasks can be org-wide or scoped more narrowly (see `TaskScope` / `SectionScope` in [Enums](/doc/backend-api/database/enums)).
- `EntryStatus` tracks a timetable entry's lifecycle (e.g. pending/complete) — see [Enums](/doc/backend-api/database/enums) for the exact values.
- Members without `VIEW_TIMETABLE` only see their own daily tasks rather than the full week calendar — see [RBAC](/doc/authentication/rbac).

## Permissions

Task and timetable mutation is gated by the same permission-flag system used elsewhere in the app:

| Flag | Unlocks |
| --- | --- |
| `MANAGE_TASKS` | Create, edit, and delete task definitions and task templates |
| `MANAGE_TIMETABLE` | Create/edit timetable templates, apply templates, drag entries, reassign, reschedule |
| `VIEW_TIMETABLE` | View the full week calendar (otherwise: own daily tasks only) |

See [RBAC](/doc/authentication/rbac) for the complete permission matrix.

## Collaboration on tasks

- `TaskComment` / `TaskCommentVote` let members discuss a task and upvote useful comments — this is part of how operational knowledge (a better technique, a correction, a tip) gets captured next to the task itself instead of staying in one person's head.

## Where the write logic lives

Following the project's [Services and Actions](/doc/backend-api/services-and-actions) split: task/timetable mutations are usually validated and authorized in `app/actions/*`, though API route handlers such as `app/api/orgs/[orgId]/tasks/*` and the mobile tool routes also perform request validation and authorization. The actual database work stays in `lib/services/*`.

## TODO

- [ ] Document the roster's relationship to task assignment in more depth (today, see [Roster](/doc/features/built-in-tools/roster) for the staffing side).
- [ ] Document the planned V3 "fair rotation" and "smart recommendation" scheduling features once implemented — see [Roadmap](/doc/roadmap).
