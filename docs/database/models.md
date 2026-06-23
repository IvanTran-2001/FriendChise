---
title: Data Models
description: The core Prisma models that power FriendChise
order: 11
---

This page summarizes the main data structures in the schema.

## Core relationships

- `User` — a signed-in account.
- `Organization` — the main tenant and franchise root.
- `Membership` — connects a user to an organization.
- `Role` — an org-scoped role used for permission gating.
- `Permission` — links a role to a permission action.
- `MemberRole` — membership-to-role junction.

The main mental model is simple: users belong to orgs through memberships, roles live inside orgs, and permissions gate what each role can do.

## Scheduling and tasks

- `Task` — reusable task definition.
- `TimetableEntry` — a scheduled task occurrence.
- `TimetableTemplate` — reusable schedule template.
- `TimetableSettings` — per-org timetable display settings.

## Roster and staffing

- `RosterEntry` — one shift assignment.
- `RosterDayConfig` — roster grid defaults.
- `RosterTemplate` — reusable staffing pattern.

## Tools and content

- `Tag` — org-scoped label.
- `ToolItem` — ingredient/unit pair for conversion tools.
- `ConversionSet` — named collection of conversion rates.
- `ToolItemList` — org-scoped item list.

## Collaboration and admin

- `FranchiseToken` — invite token for franchise joins.
- `Invite` — sent member/franchise invite.
- `Notification` — in-app user notification.
- `AuditLog` — append-only record of org mutations.
- `Feedback` — user-submitted issue or idea.
- `AdminUser` — super-admin allow list.
- `TaskComment` — threaded task comment.
- `TaskCommentVote` — up/down vote on a comment.

The remaining tables are supporting pieces around these flows, not separate product areas.

For audit trails, monitoring, cleanup, and rate limiting, see [Operations](/doc/architecture/operations).
