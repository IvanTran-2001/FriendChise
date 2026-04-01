# Chore / Practice Management System

A role-based chore/practice management system for organizations to manage recurring tasks, schedules, and team members. Supports franchise hierarchies where a parent org can spawn and manage child organisations.

## Tech Stack

- **Next.js 16.1.6** (App Router, TypeScript, React 19)
- **pnpm** (package manager)
- **PostgreSQL** (Supabase) + **Prisma ORM v7**
- **Auth.js v5 (NextAuth)** — Google OAuth, JWT sessions
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI**
- **Sonner** — toast notifications
- **Zod v4** — schema validation

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env and fill in values
cp .env.example .env

# Apply migrations and generate Prisma client
pnpm prisma migrate dev

# Seed with sample data
pnpm seed

# Start dev server
pnpm dev
```

> For production deployments use `pnpm prisma migrate deploy`.

Required environment variables:

```env
AUTH_SECRET=           # generate with: npx auth secret
AUTH_GOOGLE_ID=        # Google OAuth client ID
AUTH_GOOGLE_SECRET=    # Google OAuth client secret
AUTH_URL=              # e.g. http://localhost:3000
DATABASE_URL=          # PostgreSQL connection string
```

## Database

Provider: PostgreSQL (Supabase), managed via Prisma ORM.

### Models

| Model                    | Description                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `Organization`           | Top-level tenant. Owns all other resources. Supports franchise hierarchy via `parentId`.                           |
| `User`                   | Auth account, identified by email. Linked to orgs via `Membership`.                                                |
| `Membership`             | Links a `User` to an `Organization`. Tracks `workingDays` and `status` (ACTIVE / RESTRICTED).                      |
| `Role`                   | Org-scoped role (e.g. Owner, Worker) with a name, color, and stable `key`. System roles have `isDeletable: false`. |
| `Permission`             | Grants a `PermissionAction` enum value to a `Role`. One row per action per role.                                   |
| `MemberRole`             | Many-to-many junction between `Membership` and `Role`. A member can hold multiple roles.                           |
| `Task`                   | Reusable task definition (name, duration, recurrence constraints, eligibility by role).                            |
| `TaskEligibility`        | Links a `Task` to a `Role`, defining which roles can be assigned to it.                                            |
| `TimetableEntry`         | A scheduled task occurrence with date, start/end times, status, and assignees.                                     |
| `TimetableEntryAssignee` | Links a `Membership` to a `TimetableEntry` (many-to-many).                                                         |
| `TimetableSettings`      | Per-org timetable display preferences (view type, start day, slot duration).                                       |
| `Template`               | A reusable schedule template with a `cycleLengthDays`. Contains `TemplateEntry` rows.                              |
| `TemplateEntry`          | One time slot in a `Template` — which task, which day index, start/end times.                                      |
| `TemplateEntryAssignee`  | Pre-assigns a `Membership` to a `TemplateEntry`.                                                                   |
| `FranchiseToken`         | One-time invite token issued by a parent org for a franchisee to join.                                             |

### Enums

| Enum               | Values                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `PermissionAction` | `MANAGE_MEMBERS`, `MANAGE_ROLES`, `MANAGE_TIMETABLE`, `MANAGE_TASKS`, `MANAGE_SETTINGS`, `VIEW_TIMETABLE` |
| `EntryStatus`      | `TODO`, `IN_PROGRESS`, `DONE`, `SKIPPED`, `CANCELLED`                                                     |
| `MembershipStatus` | `ACTIVE`, `RESTRICTED`                                                                                    |
| `ViewType`         | `DAILY`, `WEEKLY`                                                                                         |

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
- The Prisma adapter stores `User` and `Account` records in Postgres for OAuth account linking
- The signed-in user's database `id` is mapped from `token.sub` into `session.user.id` so API routes and server actions can look up `Membership` records for authorization

Configure your Google OAuth app at [console.cloud.google.com](https://console.cloud.google.com) and set the redirect URI to `http://localhost:3000/api/auth/callback/google`.

### Auth config split

Auth.js config is intentionally split into two files:

| File             | Purpose                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `auth.config.ts` | Edge-compatible config (no Prisma). Used by middleware for fast auth checks.                        |
| `auth.ts`        | Full config with Prisma adapter and JWT session callback. Used by API routes and server components. |

This is required because Next.js middleware runs on the **Edge runtime**, which cannot import Node.js modules like `@prisma/client`.

`proxy.ts` contains the auth middleware. It uses the edge-compatible `authConfig` to protect matched routes without hitting the database.

### Authorization model

Auth guards live in `lib/authz/` — a directory split by calling context. All three contexts share low-level DB helpers in `_shared.ts`.

| File                  | Used by                | Returns on failure                                |
| --------------------- | ---------------------- | ------------------------------------------------- |
| `lib/authz/api.ts`    | API route handlers     | `{ ok: false, response: NextResponse }` (401/403) |
| `lib/authz/page.ts`   | Server page components | Calls `redirect()` directly                       |
| `lib/authz/action.ts` | Server actions         | `{ ok: false }` — no side effects                 |

Each context exposes three guards at increasing strictness:

| Guard                             | Requirement                                                        |
| --------------------------------- | ------------------------------------------------------------------ |
| `requireUser*()`                  | Caller must be signed in                                           |
| `requireOrgMember*(orgId)`        | Caller must be signed in and hold a `Membership` in the org        |
| `requireOrgPermission*(orgId, p)` | Caller must be a member whose role(s) grant `PermissionAction` `p` |

`requireParentOrgOwner*(orgId)` is also available in `page` and `action` contexts — it requires the caller to be the owner of an org with no `parentId` (i.e. a franchisor).

## API Routes

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

## Project Structure

```text
app/
  (app)/                  # Authenticated app shell (navbar + sidebar layout)
    page.tsx              # Home / landing page
    layout.tsx            # Shared layout: SidebarProvider, NavBar, PageHeader
    orgs/
      new/                # Create org page
      [orgId]/
        page.tsx          # Org overview
        franchisee/       # Franchise management (parent org owners only)
        memberships/      # Members list + invite new member
        tasks/            # Task definition list + create form
          [taskId]/       # Task detail view
            edit/         # Edit task form
        timetable/        # Weekly timetable, template selector, template editor
        settings/
          page.tsx        # Redirects to /settings/organization
          organization/   # Org info, timezone, hours, transfer, delete
          roles/          # Role list, create, edit (MANAGE_ROLES)
            new/          # Create role form
            [roleId]/edit/# Edit role form
          timetable/      # Timetable display settings (stub)
          notification/   # Notification preferences (stub)
  (auth)/
    signin/               # Google OAuth sign-in page
  actions/                # Server Actions (web UI mutations)
    orgs.ts               # createOrg, updateOrgSettings, transferOrgOwnership, deleteOrg, joinFranchise
    memberships.ts        # createMembership, deleteMembership
    tasks.ts              # createTaskAction, deleteTaskAction, updateTaskAction, addEligibilityAction, removeEligibilityAction
    templates.ts          # createTemplate, updateTemplateEntry, deleteTemplateEntry, etc.
    franchisee.ts         # generateFranchiseToken, deleteFranchiseToken, removeFranchisee, etc.
    roles.ts              # deleteRoleAction, createRoleAction, updateRoleAction
  api/                    # REST API route handlers (external/mobile clients)
    auth/[...nextauth]/   # Auth.js handler
    orgs/
      route.ts            # POST /api/orgs
      [orgId]/
        is-parent-owner/  # GET — check if current user is parent org owner
        memberships/      # GET, POST, DELETE
        tasks/            # GET, POST, DELETE
        task-instances/   # GET, POST
          [taskInstanceId]/
            route.ts      # GET
            assignees/    # GET, POST, DELETE
            status/       # PATCH

components/
  layout/
    navbar.tsx                  # Top bar (server component) — sidebar toggle, org switcher, user menu
    navbar-context-actions.tsx  # Route-aware action buttons (client boundary)
    page-header.tsx             # Breadcrumb bar (client component, auto-builds from pathname)
    sidebar.tsx                 # Dynamic collapsible nav (client component)
    org-switcher.tsx            # Org selector dropdown
    toolbar.tsx                 # Sticky sub-header with optional Actions dropdown
    actions/                    # Per-page action button components
      tasks-actions.tsx
      members-actions.tsx
  ui/                           # shadcn/ui + Radix UI primitives
    alert-dialog.tsx
    button.tsx
    card.tsx
    dropdown-menu.tsx
    input.tsx
    separator.tsx
    sheet.tsx
    sidebar.tsx
    skeleton.tsx
    timezone-select.tsx
    tooltip.tsx

lib/
  prisma.ts             # Prisma client singleton
  rbac.ts               # Well-known role key constants (OWNER, DEFAULT_MEMBER)
  utils.ts              # cn() and general utilities
  authz/
    _shared.ts          # Low-level DB helpers (getAuthUserId, getOrgMembership, memberHasPermission)
    api.ts              # Guards for API route handlers → { ok, response }
    page.ts             # Guards for server pages → redirect()
    action.ts           # Guards for server actions → { ok }
    index.ts            # Re-exports all guards
  services/             # Business logic layer — shared by API routes and Server Actions
    types.ts            # ServiceResult<T> discriminated union
    orgs.ts             # createOrg, updateOrgSettings, transferOrgOwnership, deleteOrg
    memberships.ts      # getMemberships, createMembership, deleteMembership
    tasks.ts            # getTasks, getTaskById, createTask, deleteTask, updateTask, addTaskEligibility, removeTaskEligibility, setTaskEligibilities
    task-instances.ts   # getTaskInstances, createTaskInstance, updateTaskInstanceStatus
    assignees.ts        # getAssignees, createAssignee, deleteAssignee
    templates.ts        # getTimetableTemplates, getTimetableTemplate, template mutations
    roles.ts            # getRoles, getRoleById, deleteRole, createRole, updateRole
    franchise.ts        # cloneRolesFromParent, cloneTasksFromParent, etc.
  validators/           # Zod schemas for request body validation
    org.ts
    membership.ts
    task.ts
    task-instance.ts
    assignee.ts
    role.ts             # roleFormSchema — name, color, permissions, taskIds

prisma/
  schema.prisma         # Database schema
  seed.ts               # Dev seed data
```

## Server Actions vs API Routes

The app uses two mutation paths depending on the caller:

| Path               | Used by                                | Location       |
| ------------------ | -------------------------------------- | -------------- |
| **Server Actions** | Web UI forms and buttons               | `app/actions/` |
| **API Routes**     | External clients (mobile, third-party) | `app/api/`     |

Both are thin wrappers — they handle auth, validate input, then delegate to `lib/services/`. The service layer holds all database logic and is shared between both paths.

Server Actions call `revalidatePath` to invalidate the Next.js cache so server-rendered pages reflect the latest data without a full page reload.

## Pages

| Route                                            | Guard                                      | Description                                                         |
| ------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| `/`                                              | Signed in                                  | Home                                                                |
| `/signin`                                        | —                                          | Google OAuth sign-in                                                |
| `/orgs/new`                                      | Signed in                                  | Create a new organization                                           |
| `/orgs/[orgId]`                                  | `requireOrgMemberPage`                     | Org overview                                                        |
| `/orgs/[orgId]/franchisee`                       | `requireParentOrgOwnerPage`                | Franchise management — invite tokens + franchisee list              |
| `/orgs/[orgId]/tasks`                            | `requireOrgMemberPage`                     | Task definition list — searchable/sortable table with role filter and per-row actions (edit, duplicate, delete) |
| `/orgs/[orgId]/tasks/new`                        | `requireOrgPermissionPage MANAGE_TASKS`    | Create a new task definition with role eligibility selector          |
| `/orgs/[orgId]/tasks/[taskId]`                   | `requireOrgMemberPage`                     | Task detail view — fields, eligible roles, Actions menu (edit/delete) for `MANAGE_TASKS` holders |
| `/orgs/[orgId]/tasks/[taskId]/edit`              | `requireOrgPermissionPage MANAGE_TASKS`    | Edit a task definition's fields and role eligibility                 |
| `/orgs/[orgId]/memberships`                      | `requireOrgMemberPage`                     | Member list                                                         |
| `/orgs/[orgId]/memberships/new`                  | `requireOrgPermissionPage MANAGE_MEMBERS`  | Invite a new member by email                                        |
| `/orgs/[orgId]/timetable`                        | `requireOrgMemberPage`                     | Timetable — calendar or simple mode, week navigation                |
| `/orgs/[orgId]/timetable/templates`              | `requireOrgMemberPage`                     | Timetable template list                                             |
| `/orgs/[orgId]/timetable/templates/new`          | `requireOrgMemberPage`                     | Create a new timetable template                                     |
| `/orgs/[orgId]/timetable/templates/[templateId]` | `requireOrgMemberPage`                     | Template editor — drag-and-drop schedule builder                    |
| `/orgs/[orgId]/settings`                         | —                                          | Redirects to `/settings/organization`                               |
| `/orgs/[orgId]/settings/organization`            | `requireOrgPermissionPage MANAGE_SETTINGS` | Org info, timezone, hours, transfer, delete                         |
| `/orgs/[orgId]/settings/roles`                   | `requireOrgPermissionPage MANAGE_ROLES`    | Role list + delete custom roles                                     |
| `/orgs/[orgId]/settings/roles/new`               | `requireOrgPermissionPage MANAGE_ROLES`    | Create a new custom role                                            |
| `/orgs/[orgId]/settings/roles/[roleId]/edit`     | `requireOrgPermissionPage MANAGE_ROLES`    | Edit a custom role's name, color, permissions, and task eligibility |
| `/orgs/[orgId]/settings/timetable`               | —                                          | Timetable display settings (stub)                                   |
| `/orgs/[orgId]/settings/notification`            | —                                          | Notification preferences (stub)                                     |

All `/orgs/[orgId]/*` pages are guarded by at least `requireOrgMemberPage` — users not in the org are redirected.

## Franchise System

A parent org can spawn franchisee orgs using a one-time invite token flow:

1. Franchisor generates a token via the Franchisee page — stores a `FranchiseToken` with `invitedEmail` and `expiresAt`.
2. The invitee visits `/orgs/new` and submits the token (via `joinFranchise` server action).
3. On join, all roles, tasks, and timetable settings are cloned from the parent into the new child org (`lib/services/franchise.ts`).
4. The joining user is assigned as the franchisee org's Owner.
5. The parent org owner can view all child orgs and pending tokens, extend/revoke tokens, and remove franchisees.

## UI Notes

- **Sidebar active state** — uses prefix matching so nested pages (e.g. `/tasks/new`) correctly highlight the parent nav item. The Org Overview item uses exact matching to avoid lighting up on every org page.
- **Breadcrumb** — `PageHeader` auto-builds a breadcrumb from the current pathname using a segment label map. No per-page configuration needed.
- **Form validation** — server-action errors are rendered inline next to each field with `aria-invalid` / `aria-describedby` for accessibility, plus a Sonner toast summary.
- **Timetable** — the server page fetches the week's entries (scoped to `date` in `[monday, monday+7)`) and passes them to `TimetableClient`. The client handles Calendar / Simple mode toggle, Prev/Next week navigation via `?week=` and `?mode=` params. Calendar view uses absolute positioning to render task blocks by time; overlapping tasks are assigned side-by-side columns. Status colours: gray = TODO, amber = IN_PROGRESS, green = DONE, red = SKIPPED.
- **Template editor** — `TemplateEditorClient` renders a drag-and-drop grid over the org's operating hours. Entries can be added, moved, resized, and assigned to members.
- **Task table** — `TaskTable` (client component) replaces the old static list. Toolbar has a search input, sort dropdown (name/duration/people), role filter dropdown, and an Actions menu with a "Create" entry. Each row has a `···` menu with **Edit**, **Duplicate**, and **Delete**. Delete opens an `AlertDialog` for confirmation before calling `deleteTaskAction`. Clicking elsewhere on a row navigates to the task detail page. The server page fetches tasks (now with `eligibility` included) and roles in parallel via `Promise.all`.
- **Roles page** — system roles (Owner, Default Member) show a `system` badge and cannot be deleted. The Owner role also cannot be edited. Custom roles show a `···` menu with Edit and Delete (with AlertDialog confirmation). The create/edit form includes a two-column task eligibility picker: the left panel lists tasks assigned to the role; the right panel lists available tasks. Click `+` / `−` to move tasks between panels. Both panels scroll independently.
- **Role security** — `createRole` and `updateRole` resolve `taskIds` against `Task` scoped to `orgId` inside the transaction. Any ID belonging to another org causes the transaction to abort with an `INVALID` error, preventing cross-tenant `TaskEligibility` rows. Both also deduplicate incoming `taskIds` and `permissions` with `new Set` before `createMany` to avoid unique-constraint failures.

## Status

Work in progress. Fully implemented: service layer, REST API, auth, member management, task management, timetable view, timetable templates, org settings, role management (list, create, edit, delete, task eligibility), franchise management.

Not yet started: schedule generation (automatic cycle-based rotation), worker "Today" checklist, completion stats, timetable/notification settings pages.
