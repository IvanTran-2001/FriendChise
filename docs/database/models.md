---
title: Data Models
description: The core Prisma models that power FriendChise
order: 11
---

This page summarizes the main data structures in the schema.

## Core tenant models

- `Organization` — top-level tenant and franchise hierarchy root.
- `User` — auth account identified by email.
- `Membership` — links a user to an organization.
- `Role` — org-scoped role with color, key, and permissions.
- `Permission` — maps a permission action to a role.
- `MemberRole` — many-to-many membership-to-role junction.

## Scheduling and task models

- `Task` — reusable task definition.
- `TaskEligibility` — which roles can be assigned to a task.
- `TimetableEntry` — a scheduled task occurrence.
- `TimetableEntryAssignee` — membership assigned to a timetable entry.
- `TimetableSettings` — per-org timetable display settings.
- `TimetableTemplate` — reusable schedule template.
- `TimetableTemplateEntry` — one slot in a timetable template.
- `TimetableTemplateEntryAssignee` — pre-assigned template membership.

## Roster and staffing models

- `RosterEntry` — one shift assignment.
- `RosterDayConfig` — roster grid defaults.
- `RosterTemplate` — reusable staffing pattern.
- `RosterTemplateEntry` — one slot inside a roster template.

## Tooling and content models

- `Tag` — org-scoped label.
- `TaskTag` — task/tag junction.
- `ToolItem` — ingredient/unit pair for conversion tools.
- `ConversionSet` — named collection of conversion rates.
- `ConversionRate` — one directional rate.
- `ConversionTemplate` — saved from/to selection state.
- `ConversionTemplateEntry` — one item slot in a conversion template.
- `ToolItemList` — org-scoped item list.
- `ToolItemGridConfig` — grid configuration for a list.
- `ToolItemListEntry` — one entry in a list.
- `ToolItemChecklistEntry` — checked state for list items.

## Collaboration and admin models

- `FranchiseToken` — invite token for franchise joins.
- `Invite` — sent member/franchise invite.
- `Notification` — in-app user notification.
- `AuditLog` — append-only record of org mutations.
- `Feedback` — user-submitted issue or idea.
- `AdminUser` — super-admin allow list.
- `TaskInheritance` — tracks global task inheritance.
- `TaskSectionLayout` — per-task section configuration.
- `TaskComment` — threaded task comment.
- `TaskCommentVote` — up/down vote on a comment.
