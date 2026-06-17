---

title: API

order: 18.5

---
All routes are prefixed with `/api`. Permissions refer to `PermissionAction` enum values.

### Orgs — `/api/orgs`

| Method | Path        | Auth      | Description                                                                                               |
| ------ | ----------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/orgs` | Signed in | Create a new org. Bootstraps Owner + Default Member roles with permissions and adds the creator as Owner. |

### Org — `/api/orgs/[orgId]`

| Method | Path                                | Auth      | Description                                                |
| ------ | ----------------------------------- | --------- | ---------------------------------------------------------- |
| `GET`  | `/api/orgs/[orgId]/is-parent-owner` | Signed in | Returns `{ isParentOwner: boolean }` for the current user. |

### Memberships — `/api/orgs/[orgId]/memberships`

| Method   | Path                            | Auth             | Description                                           |
| -------- | ------------------------------- | ---------------- | ----------------------------------------------------- |
| `GET`    | `/api/orgs/[orgId]/memberships` | `MANAGE_MEMBERS` | List all members of an org (includes user and roles). |
| `POST`   | `/api/orgs/[orgId]/memberships` | `MANAGE_MEMBERS` | Add a user to an org by email.                        |
| `DELETE` | `/api/orgs/[orgId]/memberships` | `MANAGE_MEMBERS` | Remove a user from an org.                            |

### Tasks — `/api/orgs/[orgId]/tasks`

| Method   | Path                      | Auth           | Description                           |
| -------- | ------------------------- | -------------- | ------------------------------------- |
| `GET`    | `/api/orgs/[orgId]/tasks` | Member         | List all task definitions for an org. |
| `POST`   | `/api/orgs/[orgId]/tasks` | `MANAGE_TASKS` | Create a new task definition.         |
| `DELETE` | `/api/orgs/[orgId]/tasks` | `MANAGE_TASKS` | Delete a task definition.             |

### Timetable Entries — `/api/orgs/[orgId]/task-instances`

| Method | Path                                                | Auth           | Description                                                                                   |
| ------ | --------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `GET`  | `/api/orgs/[orgId]/task-instances`                  | Member         | List timetable entries. Supports `?status=` or `?completed=true\|false` (mutually exclusive). |
| `POST` | `/api/orgs/[orgId]/task-instances`                  | `MANAGE_TASKS` | Create a timetable entry from an existing task definition.                                    |
| `GET`  | `/api/orgs/[orgId]/task-instances/[taskInstanceId]` | Member         | Get a single timetable entry by ID.                                                           |

### Timetable Entry Assignees — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/assignees`

| Method   | Path            | Auth               | Description                                                                 |
| -------- | --------------- | ------------------ | --------------------------------------------------------------------------- |
| `GET`    | `.../assignees` | Member             | List all assignees for a timetable entry (includes membership, user, role). |
| `POST`   | `.../assignees` | `MANAGE_TIMETABLE` | Assign a member to a timetable entry.                                       |
| `DELETE` | `.../assignees` | `MANAGE_TIMETABLE` | Remove a member from a timetable entry.                                     |

### Timetable Entry Status — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/status`

| Method  | Path         | Auth               | Description                                                                        |
| ------- | ------------ | ------------------ | ---------------------------------------------------------------------------------- |
| `PATCH` | `.../status` | `MANAGE_TIMETABLE` | Update the status of a timetable entry (`TODO`, `IN_PROGRESS`, `DONE`, `SKIPPED`). |
