# Chore / Practice Management System (WIP)

A role-based chore/practice management system to rotate recurring tasks fairly and track completion history.

## MVP (in progress)

- Organizations + roles (Owner/Manager/Worker)
- Task templates (recurring)
- Weekly schedule generation (fair rotation)
- Worker “Today” checklist
- Completion tracking + basic stats

## Tech Stack

- Next.js (TypeScript)
- pnpm
- Postgres (Supabase) + Prisma

## Database

Provider: PostgreSQL (Supabase), managed via Prisma ORM.

### Models

| Model                  | Description                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `Organization`         | Top-level tenant. Owns all other resources.                                             |
| `User`                 | A user account, identified by email.                                                    |
| `Membership`           | Join table linking a `User` to an `Organization`, with an optional `Role`.              |
| `Role`                 | An org-scoped role (e.g. Manager, Worker) with a set of permissions.                    |
| `RolePermission`       | Grants a specific `OrgPermission` enum value to a `Role`.                               |
| `Task`                 | A reusable task template belonging to an org (title, duration, recurrence constraints). |
| `TaskEligibility`      | Links a `Task` to a `Role`, defining which roles can be assigned to it.                 |
| `TaskCycle`            | A planning horizon (e.g. weekly) that groups a set of `TaskInstance`s.                  |
| `TaskInstance`         | A scheduled occurrence of a `Task`, with status, scheduled times, and assignees.        |
| `TaskInstanceAssignee` | Links a `Membership` to a `TaskInstance` (many-to-many).                                |

### Migrations

```bash
# Create and apply a new migration
pnpm prisma migrate dev --name <migration-name>

# Regenerate the Prisma client after schema changes
pnpm prisma generate

# Seed the database
pnpm seed
```

## API Routes

All routes are prefixed with `/api`.

### Orgs — `/api/orgs`

| Method | Path        | Description                |
| ------ | ----------- | -------------------------- |
| `GET`  | `/api/orgs` | List all organizations.    |
| `POST` | `/api/orgs` | Create a new organization. |

### Memberships — `/api/orgs/[orgId]/memberships`

| Method | Path                            | Description                                          |
| ------ | ------------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/orgs/[orgId]/memberships` | List all members of an org (includes user and role). |
| `POST` | `/api/orgs/[orgId]/memberships` | Add a user to an org with an optional role.          |

### Tasks — `/api/orgs/[orgId]/tasks`

| Method | Path                      | Description                         |
| ------ | ------------------------- | ----------------------------------- |
| `GET`  | `/api/orgs/[orgId]/tasks` | List all task templates for an org. |
| `POST` | `/api/orgs/[orgId]/tasks` | Create a new task template.         |

### Task Instances — `/api/orgs/[orgId]/task-instances`

| Method | Path                                              | Description                                                                               |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET`  | `/api/orgs/[orgId]/task-instances`                | List task instances for an org. Supports either `?status=` or `?completed=true\|false` (not both). |
| `POST` | `/api/orgs/[orgId]/task-instances`                | Create a new task instance from a task template.                                          |
| `GET`  | `/api/orgs/[orgId]/task-instances/[taskInstanceId]` | Get a single task instance by ID.                                                        |

### Task Instance Assignees — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/assignees`

| Method   | Path            | Description                                                               |
| -------- | --------------- | ------------------------------------------------------------------------- |
| `GET`    | `.../assignees` | List all assignees for a task instance (includes membership, user, role). |
| `POST`   | `.../assignees` | Assign a member to a task instance.                                       |
| `DELETE` | `.../assignees` | Remove a member from a task instance.                                     |

### Task Instance Status — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/status`

| Method  | Path         | Description                                                                      |
| ------- | ------------ | -------------------------------------------------------------------------------- |
| `PATCH` | `.../status` | Update the status of a task instance (`TODO`, `IN_PROGRESS`, `DONE`, `SKIPPED`). |

## Status

Work in progress — initial scaffolding and planning.
