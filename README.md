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

## Authentication

Authentication is handled by **Auth.js v5 (NextAuth)** with **Google OAuth** as the provider.

- Route: `GET|POST /api/auth/[...nextauth]` (handled automatically by Auth.js)
- Session strategy: database (sessions stored in Postgres via Prisma adapter)
- The signed-in user's database `id` is attached to the session so API routes can look up `Membership` records for authorization

### Setup

```bash
pnpm add next-auth@beta @auth/prisma-adapter
```

Required environment variables:

```env
AUTH_SECRET=        # generate with: npx auth secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Configure your Google OAuth app at [console.cloud.google.com](https://console.cloud.google.com) and set the redirect URI to:

```
http://localhost:3000/api/auth/callback/google
```

### Authorization model

Two helper functions in `lib/authz.ts` protect all org-scoped routes:

| Helper                                    | Requirement                                                      |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `requireUser()`                           | User must be signed in (any authenticated user)                  |
| `requireOrgMember(orgId)`                 | User must be signed in and have a `Membership` in the org        |
| `requireOrgPermission(orgId, permission)` | User must be a member whose `Role` has the given `OrgPermission` |

Both return `{ ok: false, response }` on failure (401 Unauthorized or 403 Forbidden) so routes can early-return with `if (!authz.ok) return authz.response`.

## API Routes

All routes are prefixed with `/api`. Each route notes the minimum permission required.

### Orgs — `/api/orgs`

| Method | Path        | Auth   | Description                                                                               |
| ------ | ----------- | ------ | ----------------------------------------------------------------------------------------- |
| `POST` | `/api/orgs` | Signed in | Create a new org. Auto-creates Owner and Member roles with permissions and adds the creator as Owner. |

### Memberships — `/api/orgs/[orgId]/memberships`

| Method   | Path                            | Auth         | Description                                          |
| -------- | ------------------------------- | ------------ | ---------------------------------------------------- |
| `GET`    | `/api/orgs/[orgId]/memberships` | `ORG_MANAGE` | List all members of an org (includes user and role). |
| `POST`   | `/api/orgs/[orgId]/memberships` | `ORG_MANAGE` | Add a user to an org with an optional role.          |
| `DELETE` | `/api/orgs/[orgId]/memberships` | `ORG_MANAGE` | Remove a user from an org.                           |

### Tasks — `/api/orgs/[orgId]/tasks`

| Method   | Path                      | Auth          | Description                         |
| -------- | ------------------------- | ------------- | ----------------------------------- |
| `GET`    | `/api/orgs/[orgId]/tasks` | Member        | List all task templates for an org. |
| `POST`   | `/api/orgs/[orgId]/tasks` | `TASK_CREATE` | Create a new task template.         |
| `DELETE` | `/api/orgs/[orgId]/tasks` | `TASK_DELETE` | Delete a task template.             |

### Task Instances — `/api/orgs/[orgId]/task-instances`

| Method | Path                                                | Auth          | Description                                                                                        |
| ------ | --------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/orgs/[orgId]/task-instances`                  | Member        | List task instances for an org. Supports either `?status=` or `?completed=true\|false` (not both). |
| `POST` | `/api/orgs/[orgId]/task-instances`                  | `TASK_CREATE` | Create a new task instance from a task template.                                                   |
| `GET`  | `/api/orgs/[orgId]/task-instances/[taskInstanceId]` | Member        | Get a single task instance by ID.                                                                  |

### Task Instance Assignees — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/assignees`

| Method   | Path            | Auth          | Description                                                               |
| -------- | --------------- | ------------- | ------------------------------------------------------------------------- |
| `GET`    | `.../assignees` | Member        | List all assignees for a task instance (includes membership, user, role). |
| `POST`   | `.../assignees` | `TASK_ASSIGN` | Assign a member to a task instance.                                       |
| `DELETE` | `.../assignees` | `TASK_ASSIGN` | Remove a member from a task instance.                                     |

### Task Instance Status — `/api/orgs/[orgId]/task-instances/[taskInstanceId]/status`

| Method  | Path         | Auth                    | Description                                                                      |
| ------- | ------------ | ----------------------- | -------------------------------------------------------------------------------- |
| `PATCH` | `.../status` | `TASKINSTANCE_COMPLETE` | Update the status of a task instance (`TODO`, `IN_PROGRESS`, `DONE`, `SKIPPED`). |

## Status

Work in progress — initial scaffolding and planning.
