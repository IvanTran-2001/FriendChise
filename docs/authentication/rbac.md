---
title: RBAC
description: Roles, permissions, and franchisor-only access rules
order: 18.6
---

FriendChise uses org-scoped roles plus a small set of fixed system roles. Owner has full access, Default Member is the baseline invite role, and custom roles combine permission flags chosen by the org owner.

## Role model

- **Owner** — fixed system role with all permissions automatically applied. Cannot be edited or deleted.
- **Default Member** — fixed system role for every invited member. Starts with no permissions, but its permission set is editable. Cannot be deleted.
- **Custom role** — any role created by the org owner. It is a named combination of permission flags.

## Permission flags

| Flag | What it unlocks |
| --- | --- |
| `MANAGE_MEMBERS` | Invite, remove, and change member roles |
| `MANAGE_ROLES` | Create, edit, and delete custom roles |
| `MANAGE_TIMETABLE` | Create/edit timetable templates, apply templates, drag entries, reassign, and reschedule |
| `MANAGE_TASKS` | Create, edit, and delete task definitions and task templates |
| `MANAGE_SETTINGS` | Edit org settings such as name and open/close hours |
| `VIEW_TIMETABLE` | View the full week calendar; without it, members only see their own daily tasks |

## Parent-org-only access

Some actions are only available to the owner of a parent org and are never shown to child org owners:

- Delete a child org from the franchise network
- Transfer ownership of a child org to another member
- Access franchisee management for all child orgs

## Notes for contributors

- `lib/authz/` is where the guards live.
- `requireOrgPermission*()` handles permission-gated actions.
- `requireParentOrgOwner*()` gates franchisor-only screens.