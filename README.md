# Chore / Practice Management System (WIP)

A role-based chore/practice management system to rotate recurring tasks fairly and track completion history.

## MVP (in progress)

- [x] Organizations + roles (Owner / Member) with per-role permissions
- [x] Task templates (title, duration, recurrence constraints, people required)
- [x] Task instances — scheduled occurrences of a task template
- [x] Member management — invite by email, assign roles
- [x] Assignee tracking on task instances
- [x] Task instance status updates (`TODO` → `IN_PROGRESS` → `DONE` / `SKIPPED`)
- [x] Timetable view — weekly calendar and simple (list) modes with task instance blocks
- [ ] Weekly schedule generation (fair rotation)
- [ ] Worker "Today" checklist
- [ ] Completion tracking + basic stats

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **pnpm** (package manager)
- **PostgreSQL** (Supabase) + **Prisma ORM**
- **Auth.js v5 (NextAuth)** — Google OAuth, JWT sessions
- **Tailwind CSS v4** + **shadcn/ui**

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env and fill in values
cp .env.example .env

# Push schema to database (no migration history, dev only)
pnpm prisma db push

# Seed with sample data
pnpm seed

# Start dev server
pnpm dev
```

> For production use `pnpm prisma migrate deploy` instead of `db push`.

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
| `TimetableTemplate`    | A planning horizon/template (e.g. weekly) that groups a set of `TaskInstance`s.         |
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
- Session strategy: **JWT** (tokens signed with `AUTH_SECRET`, stored in a cookie — no DB reads on every request)
- The Prisma adapter still stores `User` and `Account` records in Postgres for OAuth account linking
- The signed-in user's database `id` is mapped from `token.sub` into `session.user.id` so API routes can look up `Membership` records for authorization
- Auth is split across two files to support the Next.js Edge runtime in middleware (see [Auth config split](#auth-config-split))

### Setup

```bash
pnpm add next-auth@beta @auth/prisma-adapter
```

Required environment variables:

```env
AUTH_SECRET=           # generate with: npx auth secret
AUTH_GOOGLE_ID=        # Google OAuth client ID
AUTH_GOOGLE_SECRET=    # Google OAuth client secret
AUTH_URL=              # e.g. http://localhost:3000
DATABASE_URL=          # PostgreSQL connection string
```

Configure your Google OAuth app at [console.cloud.google.com](https://console.cloud.google.com) and set the redirect URI to `http://localhost:3000/api/auth/callback/google`.

### Authorization model

Two helper functions in `lib/authz.ts` protect all org-scoped routes:

| Helper                                    | Requirement                                                      |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `requireUser()`                           | User must be signed in (any authenticated user)                  |
| `requireOrgMember(orgId)`                 | User must be signed in and have a `Membership` in the org        |
| `requireOrgPermission(orgId, permission)` | User must be a member whose `Role` has the given `OrgPermission` |

Both return `{ ok: false, response }` on failure (401 Unauthorized or 403 Forbidden) so routes can early-return with `if (!authz.ok) return authz.response`.

### Auth config split

Auth.js config is intentionally split into two files:

| File             | Purpose                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `auth.config.ts` | Edge-compatible config (no Prisma). Used by middleware for fast auth checks.                        |
| `auth.ts`        | Full config with Prisma adapter and JWT session callback. Used by API routes and server components. |

This is required because Next.js middleware runs on the **Edge runtime**, which cannot import Node.js modules like `@prisma/client`.

### Middleware

`proxy.ts` contains the auth middleware. It uses the edge-compatible `authConfig` to protect matched routes without hitting the database.

## API Routes

All routes are prefixed with `/api`. Each route notes the minimum permission required.

### Orgs — `/api/orgs`

| Method | Path        | Auth      | Description                                                                                           |
| ------ | ----------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `POST` | `/api/orgs` | Signed in | Create a new org. Auto-creates Owner and Member roles with permissions and adds the creator as Owner. |

### Memberships — `/api/orgs/[orgId]/memberships`

| Method   | Path                            | Auth         | Description                                          |
| -------- | ------------------------------- | ------------ | ---------------------------------------------------- |
| `GET`    | `/api/orgs/[orgId]/memberships` | `ORG_MANAGE` | List all members of an org (includes user and role). |
| `POST`   | `/api/orgs/[orgId]/memberships` | `ORG_MANAGE` | Add a user to an org with a role.                    |
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

## Project Structure

```text
app/
  (app)/          # Authenticated app shell (navbar + sidebar layout)
    orgs/
      new/        # Create org page
      [orgId]/
        page.tsx         # Org overview
        tasks/           # Task list + create task form
        memberships/     # Members list
        timetable/       # Weekly timetable (calendar + simple modes)
  (auth)/         # Unauthenticated pages (sign in)
  actions/        # Server Actions (web UI mutations)
    orgs.ts       # createOrg action
    tasks.ts      # createTaskAction
  api/            # REST API route handlers (external/mobile clients)
components/
  layout/
    navbar.tsx              # Top bar (server component)
    navbar-context-actions.tsx  # Route-aware action buttons (client boundary)
    actions/                # Per-page action button components
      tasks-actions.tsx
      members-actions.tsx
    sidebar.tsx             # Dynamic sidebar nav (client component)
    org-switcher.tsx        # Org selector dropdown
  ui/             # shadcn/ui primitives
lib/
  services/       # Business logic layer — called by both API routes and Server Actions
    types.ts      # ServiceResult<T> discriminated union
    orgs.ts
    memberships.ts
    tasks.ts
    task-instances.ts
    assignees.ts
  authz.ts        # Server-side auth guard helpers
  rbac.ts         # Predefined role key constants
  prisma.ts       # Prisma client singleton
  validators/     # Zod schemas for request body validation
prisma/
  schema.prisma   # Database schema
  seed.ts         # Dev seed data
```

## Server Actions vs API Routes

The app uses two mutation paths depending on the caller:

| Path               | Used by                                | Location       |
| ------------------ | -------------------------------------- | -------------- |
| **Server Actions** | Web UI forms                           | `app/actions/` |
| **API Routes**     | External clients (mobile, third-party) | `app/api/`     |

Both are thin wrappers — they handle auth, validate input, then delegate to `lib/services/`. The service layer holds all database logic and is shared between both paths.

Server Actions use `revalidatePath` to invalidate the Next.js cache so server-rendered pages reflect the latest data without a full page reload.

## Pages

| Route                               | Guard                              | Description                                          |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `/`                                 | Signed in                          | Home — authenticated app shell                       |
| `/signin`                           | —                                  | Google OAuth sign-in                                 |
| `/orgs/new`                         | Signed in                          | Create a new organization                            |
| `/orgs/[orgId]`                     | `requireOrgMember`                 | Org overview (placeholder)                           |
| `/orgs/[orgId]/tasks`               | `requireOrgMember`                 | Task template list                                   |
| `/orgs/[orgId]/tasks/new`           | `requireOrgPermission TASK_CREATE` | Create a new task template                           |
| `/orgs/[orgId]/memberships`         | `requireOrgMember`                 | Member list                                          |
| `/orgs/[orgId]/memberships/new`     | `requireOrgPermission ORG_MANAGE`  | Invite a new member by email                         |
| `/orgs/[orgId]/timetable`           | `requireOrgMember`                 | Timetable — calendar or simple mode, week navigation |
| `/orgs/[orgId]/timetable/templates` | `requireOrgMember`                 | Timetable templates (coming soon)                    |

All `/orgs/[orgId]/*` pages are guarded by at least `requireOrgMember` — users not in the org are redirected to `/`.

## UI Notes

- **Sidebar active state** — uses prefix matching so nested pages (e.g. `/tasks/new`) correctly highlight the parent nav item. The Org Overview item uses exact matching to avoid lighting up on every org page.
- **Form validation** — server-action errors are rendered inline next to each field with `aria-invalid` / `aria-describedby` for accessibility, plus a Sonner toast summary.
- **Timetable** — the server page fetches the week's instances (scoped to `scheduledStartAt` in `[monday, monday+7)`) and renders the Calendar/Simple mode links; the client component handles the interactive timetable UI plus Prev/Next week navigation via `?week=` and `?mode=` search params. Calendar view uses absolute positioning to render task blocks by time; overlapping tasks are assigned side-by-side columns. Status colours: gray = TODO, amber = IN_PROGRESS, green = DONE, red = SKIPPED.

## Status

Work in progress — service layer, REST API, task management, member management, auth, and timetable view fully implemented. Schedule generation (automatic cycle-based rotation) and completion stats not yet started.
