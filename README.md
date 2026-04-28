# FriendChise

[![CI](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml/badge.svg)](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org)
[![Deploy](https://img.shields.io/badge/deploy-friendchise.app-brightgreen)](https://friendchise.app)

A role-based task and schedule management platform for franchise organizations. Parent orgs can spawn and manage franchisee orgs, each with their own members, roles, tasks, and timetables.

Production deployment: **[friendchise.app](https://friendchise.app)**

## Screenshots

> _TODO: add screenshots / screen recording_

<!-- Replace this comment with: ![Timetable view](docs/screenshots/timetable.png) etc. -->

## Tech Stack

- **Next.js 16.1.6** (App Router, TypeScript, React 19)
- **pnpm** (package manager)
- **PostgreSQL** (Supabase) + **Prisma ORM v7**
- **Auth.js v5 (NextAuth)** — Google OAuth, JWT sessions
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI**
- **Sonner** — toast notifications
- **Zod v4** — schema validation
- **react-markdown** + **remark-gfm** — GFM markdown rendering for task descriptions
- **Vitest** — unit + integration tests
- **Playwright** — E2E browser tests
- **Sentry** — error monitoring, performance tracing, session replay, and server-side logs
- **Upstash Redis** + **@upstash/ratelimit** — sliding-window rate limiting on all API routes and server actions

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

# Sentry — error monitoring (get from sentry.io > Settings > Auth Tokens)
SENTRY_AUTH_TOKEN=

# Upstash Redis — rate limiting (get from console.upstash.com > your database > REST API)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optional / local overrides (`.env.local`):

```env
E2E_TEST_USER_EMAIL=      # Test user email for E2E tests and seeding (default: ivan@example.test)
SEED_DEV_IDENTIFIERS=     # Space-separated Supabase project refs to seed with dev data (seed.ts production path)
```

## Database

Provider: PostgreSQL (Supabase), managed via Prisma ORM.

### Models

| Model                    | Description                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Organization`           | Top-level tenant. Owns all other resources. Supports franchise hierarchy via `parentId`.                                                                                                                                                                                                                                                                        |
| `User`                   | Auth account, identified by email. Linked to orgs via `Membership`.                                                                                                                                                                                                                                                                                             |
| `Membership`             | Links a `User` to an `Organization`. Tracks `workingDays` and `status` (ACTIVE / RESTRICTED).                                                                                                                                                                                                                                                                   |
| `Role`                   | Org-scoped role (e.g. Owner, Worker) with a required `name`, `color` (hex), and stable `key`. System roles have `isDeletable: false`.                                                                                                                                                                                                                           |
| `Permission`             | Grants a `PermissionAction` enum value to a `Role`. One row per action per role.                                                                                                                                                                                                                                                                                |
| `MemberRole`             | Many-to-many junction between `Membership` and `Role`. A member can hold multiple roles.                                                                                                                                                                                                                                                                        |
| `Task`                   | Reusable task definition (name, required `color` hex, duration, recurrence constraints, eligibility by role).                                                                                                                                                                                                                                                   |
| `TaskEligibility`        | Links a `Task` to a `Role`, defining which roles can be assigned to it.                                                                                                                                                                                                                                                                                         |
| `TimetableEntry`         | A scheduled task occurrence with date, start/end times, status, and assignees.                                                                                                                                                                                                                                                                                  |
| `TimetableEntryAssignee` | Links a `Membership` to a `TimetableEntry` (many-to-many).                                                                                                                                                                                                                                                                                                      |
| `TimetableSettings`      | Per-org timetable display preferences (view type, start day, slot duration).                                                                                                                                                                                                                                                                                    |
| `Template`               | A reusable schedule template with a `cycleLengthDays`. Contains `TemplateEntry` rows.                                                                                                                                                                                                                                                                           |
| `TemplateEntry`          | One time slot in a `Template` — which task, which day index, start/end times.                                                                                                                                                                                                                                                                                   |
| `TemplateEntryAssignee`  | Pre-assigns a `Membership` to a `TemplateEntry`.                                                                                                                                                                                                                                                                                                                |
| `FranchiseToken`         | One-time invite token issued by a parent org for a franchisee to join.                                                                                                                                                                                                                                                                                          |
| `Invite`                 | A member or franchise invite sent to a `User`. Carries a status (`PENDING`/`ACCEPTED`/`DECLINED`), snapshot fields for the org name and inviter name, and a JSON `metadata` blob with the roleIds/workingDays pre-filled for the accept step. Visible in the notification panel.                                                                                |
| `AuditLog`               | Append-only record of significant org mutations. Stores `action` (e.g. `task.create`), `entityType`, `entityId`, optional `before`/`after` JSON snapshots, the `actorId` who triggered the change, and a `createdAt` timestamp. Scoped per org. Actor is nullable (set to `NULL` on user deletion via `onDelete: SetNull`). Org deletion cascades all its logs. |

### Enums

| Enum               | Values                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `PermissionAction` | `MANAGE_MEMBERS`, `MANAGE_ROLES`, `MANAGE_TIMETABLE`, `MANAGE_TASKS`, `MANAGE_SETTINGS`, `VIEW_TIMETABLE` |
| `EntryStatus`      | `TODO`, `IN_PROGRESS`, `DONE`, `SKIPPED`, `CANCELLED`                                                     |
| `MembershipStatus` | `ACTIVE`, `RESTRICTED`                                                                                    |
| `InviteStatus`     | `PENDING`, `ACCEPTED`, `DECLINED`                                                                         |
| `InviteType`       | `MEMBER`, `FRANCHISE`                                                                                     |
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

#### Migration history

| Migration                              | Description                                                                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260414033638_init`                  | Full initial schema — all models, enums, indexes                                                                                                                                                                 |
| `20260414035009_add_invite_metadata`   | Add `metadata` JSON field to `Invite` for storing roleIds/workingDays for the accept step                                                                                                                        |
| `20260414045652_add_invite_snapshots`  | Add snapshot fields (`orgName`, `inviterName`) to `Invite` so cards render without joins                                                                                                                         |
| `20260415021658_invite_pending_unique` | Partial unique index on `Invite(orgId, recipientId, type)` where `status = 'PENDING'` — DB-level guard against duplicate pending invites                                                                         |
| _(schema push)_                        | `AuditLog` model added (`orgId`, `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `createdAt`). Applied via `pnpm prisma db push` (dev DB had migration drift — no timestamped migration file). |

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

`proxy.ts` is the auth middleware. It uses the edge-compatible `authConfig` to protect matched routes without hitting the database, and forwards the current pathname as an `x-pathname` request header so the server-rendered breadcrumb can read it without `usePathname()`.

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
        memberships/      # Members list, search, role filter, invite new member
          [memberId]/     # Member detail view (view-only, roles, working days, status)
            page.tsx
            edit/         # Edit member form (working days, roles)
            _components/
              member-toolbar-actions.tsx  # Restrict/Unrestrict + Delete confirm dialogs
          _components/
            members-view.tsx        # Client component: toolbar, search/filter, list↔card toggle
            member-form.tsx         # Shared create/edit form (email, working days, RolePicker)
            role-picker.tsx         # Searchable role input — selecting auto-adds, no + button
        tasks/            # Task definition list + create form
          [taskId]/       # Task detail view (links from timetable)
            edit/         # Edit task form (includes color picker)
          task-form.tsx   # Shared create/edit form — title, color picker, fields, eligibility
        timetable/        # Weekly timetable, template selector, template editor
          page.tsx              # Server page: fetches week entries, permissions, roles
          timetable-client.tsx  # Client root: CalendarView / SimpleView, CalendarEditPopup
          timetable-actions.tsx # "Actions" dropdown (Apply Template, Templates link)
          apply-template-dialog.tsx  # Modal for selecting and applying a template
          role-filter-button.tsx     # Role filter dropdown (URL-state driven)
          _shared/              # Shared grid primitives
            time-grid.tsx       # Drag-and-drop time grid
            task-panel.tsx      # Sidebar panel listing draggable tasks
            grid-utils.ts       # Pure utilities: snap, layout, date helpers
            types.ts            # Shared TypeScript types
          templates/            # Template list and editor sub-pages
        settings/
          page.tsx        # Redirects to /settings/organization
          organization/   # Org info, timezone, hours, transfer, delete
          roles/          # Role list, create, edit (MANAGE_ROLES)
            new/          # Create role form (name, color, permissions, task eligibility)
            [roleId]/edit/# Edit role form
          timetable/      # Timetable display settings (stub)
          notification/   # Notification preferences (stub)
  (auth)/
    signin/               # Google OAuth sign-in page
  actions/                # Server Actions (web UI mutations)
    orgs.ts
    memberships.ts
    tasks.ts              # createTaskAction, updateTaskAction — both require color hex
    templates.ts
    timetable-entries.ts
    franchisee.ts
    roles.ts
  api/                    # REST API route handlers (external/mobile clients)
    auth/[...nextauth]/
    orgs/
      route.ts
      [orgId]/
        is-parent-owner/
        memberships/
        tasks/
        task-instances/
          [taskInstanceId]/
            route.ts
            assignees/
            status/

components/
  layout/
    navbar.tsx                  # Top bar (server component)
    navbar-context-actions.tsx  # Route-aware action buttons
    page-header.tsx             # Breadcrumb bar — async server component; resolves IDs to names via Prisma
    sidebar.tsx                 # Collapsible nav; Progress item is disabled (opacity, pointer-events-none)
    org-switcher.tsx            # Org selector dropdown
    toolbar.tsx                 # Sticky sub-header
    actions/
      tasks-actions.tsx
      members-actions.tsx
  ui/                           # shadcn/ui + Radix UI primitives

lib/
  prisma.ts
  rbac.ts               # ROLE_KEYS constants (OWNER, DEFAULT_MEMBER)
  utils.ts
  authz/
    _shared.ts
    api.ts
    page.ts
    action.ts
    index.ts
  services/
    types.ts
    audit-log.ts        # logAudit() write helper (Zod-validated) + getAuditLogs() read helper
    orgs.ts
    memberships.ts      # updateMembership rejects any roleId whose key === "owner"
    tasks.ts            # createTask / updateTask both require and persist color
    timetable-entries.ts
    assignees.ts
    templates.ts
    roles.ts
    franchise.ts
    invites.ts
    bots.ts
  validators/
    org.ts
    membership.ts
    task.ts             # createTaskSchema / updateTaskSchema require color: /^#[0-9a-fA-F]{6}$/
    task-instance.ts
    assignee.ts
    role.ts

prisma/
  schema.prisma         # Role.color String (non-nullable), Task.color String (non-nullable)
  seed.ts               # 8 users · 3 orgs · 4 roles each · 6 tasks each · 5 members each
```

## Audit Log

Significant org mutations are recorded in the `AuditLog` table. The service layer writes one row per meaningful event — reads, status-only changes, and low-signal operations are intentionally excluded.

### Service layer

| File                        | Purpose                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/services/audit-log.ts` | `recordAudit(params, client?)` — write helper that never throws; accepts optional Prisma client or transaction handle for atomic writes. `getAuditLogs(orgId, limit?)` — ordered read. |

`recordAudit` accepts an optional `client` parameter (either `PrismaClient` or `Prisma.TransactionClient`). When called inside a `$transaction`, pass the transaction handle (`tx`) to ensure the audit write is part of the same atomic operation. When called outside a transaction, omit the client parameter and the root Prisma client will be used. The function never throws — audit failures are logged to Sentry and never propagate to the caller.

### Logged actions

| Action                     | Trigger                                            |
| -------------------------- | -------------------------------------------------- |
| `org.create`               | New standalone org created                         |
| `org.join_franchise`       | Franchisee joined via token                        |
| `org.update`               | Org settings changed (timezone, address, hours)    |
| `org.transfer_ownership`   | Ownership transferred to a different member        |
| `org.delete`               | Org permanently deleted by owner                   |
| `task.create`              | Task definition created                            |
| `task.update`              | Task definition updated                            |
| `task.delete`              | Task definition deleted                            |
| `role.create`              | Custom role created                                |
| `role.update`              | Role name, color, or permissions changed           |
| `role.delete`              | Custom role deleted                                |
| `membership.create`        | Member added to org                                |
| `membership.update`        | Member working days or roles changed               |
| `membership.status_change` | Member status toggled (ACTIVE / RESTRICTED)        |
| `membership.delete`        | Member removed from org                            |
| `invite.send`              | Member or franchise invite sent                    |
| `invite.accept`            | Invite accepted (member or bot-slot)               |
| `template.create`          | Template created or duplicated                     |
| `template.update`          | Template renamed                                   |
| `template.delete`          | Template deleted                                   |
| `bot.create`               | Placeholder (bot) membership created               |
| `bot.delete`               | Placeholder membership deleted                     |
| `entry.create`             | Live timetable entry created                       |
| `entry.delete`             | Live timetable entry deleted                       |
| `franchisee.remove`        | Franchisee org permanently removed by parent owner |

### Browsing logs (no UI yet)

```bash
# Prisma Studio — table browser at localhost:5555
pnpm prisma studio
```

Or query directly in the Supabase SQL Editor:

```sql
SELECT al.action, al."entityType", al."entityId",
       al.before, al.after, al."createdAt",
       u.name AS actor
FROM "AuditLog" al
LEFT JOIN "User" u ON u.id = al."actorId"
WHERE al."orgId" = '<org-id>'
ORDER BY al."createdAt" DESC
LIMIT 100;
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

| Route                                            | Guard                                      | Description                                                                                         |
| ------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `/`                                              | Signed in                                  | Home                                                                                                |
| `/signin`                                        | —                                          | Google OAuth sign-in                                                                                |
| `/orgs/new`                                      | Signed in                                  | Create a new organization                                                                           |
| `/orgs/[orgId]`                                  | `requireOrgMemberPage`                     | Org overview                                                                                        |
| `/orgs/[orgId]/franchisee`                       | `requireParentOrgOwnerPage`                | Franchise management — invite tokens + franchisee list                                              |
| `/orgs/[orgId]/tasks`                            | `requireOrgMemberPage`                     | Task definition list — searchable/sortable table with role filter and per-row actions               |
| `/orgs/[orgId]/tasks/new`                        | `requireOrgPermissionPage MANAGE_TASKS`    | Create task — includes color picker                                                                 |
| `/orgs/[orgId]/tasks/[taskId]`                   | `requireOrgMemberPage`                     | Task detail view; clicking a task name in the timetable navigates here                              |
| `/orgs/[orgId]/tasks/[taskId]/edit`              | `requireOrgPermissionPage MANAGE_TASKS`    | Edit task — color picker pre-filled with current color                                              |
| `/orgs/[orgId]/memberships`                      | `requireOrgMemberPage`                     | Member list                                                                                         |
| `/orgs/[orgId]/memberships/new`                  | `requireOrgPermissionPage MANAGE_MEMBERS`  | Invite a new member by email                                                                        |
| `/orgs/[orgId]/memberships/[memberId]`           | `requireOrgMemberPage`                     | Member detail view — avatar, roles (multi-badge), working days, status, join date                   |
| `/orgs/[orgId]/memberships/[memberId]/edit`      | `requireOrgPermissionPage MANAGE_MEMBERS`  | Edit member — working days, roles (owner role excluded from picker)                                 |
| `/orgs/[orgId]/timetable`                        | `requireOrgMemberPage`                     | Timetable — calendar or simple mode, week navigation                                                |
| `/orgs/[orgId]/timetable/templates`              | `requireOrgMemberPage`                     | Timetable template list — card or list view; MANAGE_TASKS holders can rename, duplicate, and delete |
| `/orgs/[orgId]/timetable/templates/new`          | `requireOrgMemberPage`                     | Create a new timetable template                                                                     |
| `/orgs/[orgId]/timetable/templates/[templateId]` | `requireOrgMemberPage`                     | Template editor — Calendar (drag-and-drop grid) or Simple (day table) view; cycle-length controls   |
| `/orgs/[orgId]/settings`                         | —                                          | Redirects to `/settings/organization`                                                               |
| `/orgs/[orgId]/settings/organization`            | `requireOrgPermissionPage MANAGE_SETTINGS` | Org info, timezone, hours, transfer, delete                                                         |
| `/orgs/[orgId]/settings/roles`                   | `requireOrgPermissionPage MANAGE_ROLES`    | Role list + delete custom roles                                                                     |
| `/orgs/[orgId]/settings/roles/new`               | `requireOrgPermissionPage MANAGE_ROLES`    | Create a new custom role (name, color, permissions, task eligibility)                               |
| `/orgs/[orgId]/settings/roles/[roleId]/edit`     | `requireOrgPermissionPage MANAGE_ROLES`    | Edit a custom role                                                                                  |
| `/orgs/[orgId]/settings/timetable`               | —                                          | Timetable display settings (stub)                                                                   |
| `/orgs/[orgId]/settings/notification`            | —                                          | Notification preferences (stub)                                                                     |

All `/orgs/[orgId]/*` pages are guarded by at least `requireOrgMemberPage` — users not in the org are redirected.

## Notification System

In-app notifications are implemented via the `Invite` model and a bell icon in the navbar.

- The `NavBar` server component fetches all visible invites and an unseen count for the session user on every render.
- **Visibility window**: `PENDING` invites are always shown; `ACCEPTED`/`DECLINED` invites are shown for 7 days after being handled, then disappear naturally.
- **Unseen badge**: the bell shows a red count badge for invites where `seenAt IS NULL`. Clicking the bell calls `markInvitesSeenAction` to clear it.
- **Panel**: a `Popover` on desktop, a bottom `Sheet` on mobile (`useIsMobile` hook).
- **Invite types**: `MEMBER` (org membership invite) and `FRANCHISE` (franchise join invite). Each type shows different actions in the `InviteCard`.
- Snapshot fields (`orgName`, `inviterName`) are captured at invite creation so the card renders without additional DB joins.

## Franchise System

A parent org can spawn franchisee orgs using a one-time invite token flow:

1. Franchisor generates a token via the Franchisee page — stores a `FranchiseToken` with `invitedEmail` and `expiresAt`.
2. The invitee visits `/orgs/new` and submits the token (via `joinFranchise` server action).
3. On join, all roles, tasks, and timetable settings are cloned from the parent into the new child org (`lib/services/franchise.ts`).
4. The joining user is assigned as the franchisee org's Owner.
5. The parent org owner can view all child orgs and pending tokens, extend/revoke tokens, and remove franchisees.

## UI Notes

- **Breadcrumb** — `PageHeader` is an **async server component**. It reads the current URL from the `x-pathname` header set by `proxy.ts` middleware and resolves dynamic id segments to human-readable names via Prisma (task name, user name, role name, template name). No client-side `usePathname()` needed.
- **Sidebar** — The Progress nav item is disabled (`opacity-40 cursor-not-allowed pointer-events-none`). Active state uses prefix matching; Overview uses exact matching.
- **Colors required** — Both `Role.color` and `Task.color` are non-nullable in the schema and enforced by Zod validators (`/^#[0-9a-fA-F]{6}$/`). Create and edit forms render a native `<input type="color">` with a hex label. The color is submitted as a hidden `<input name="color">` so it flows through `FormData`.
- **Task form color picker** — Lazy `useState(() => dv?.color ?? randomHex())` initializer prevents React purity errors on random defaults.
- **Member pages** — Split into view (`[memberId]/page.tsx`) and edit (`[memberId]/edit/page.tsx`) routes. Both share `MemberForm`. The toolbar on the detail page provides Edit and an Actions ▼ dropdown (Restrict / Unrestrict / Delete with confirm dialogs).
- **Role picker** — Searchable text input with a dropdown. Selecting a role auto-adds it; no `+` button. The owner role is never shown in the picker (filtered in the edit page query and enforced in the service layer).
- **Owner role guard** — Three layers: (1) DB query filters it from `allRoles` on the edit page, (2) `updateMembership` rejects any `roleId` whose key is `"owner"`, (3) the new-member query uses `NOT: { key: "owner" }`.
- **Clicking tasks in timetable** — In Calendar view the task title inside each block is a `<Link>` to the task detail page. In Simple (table) view the task name cell is a `<Link>`; clicking elsewhere in the row still opens the edit popup.
- **Form validation** — server-action errors rendered inline with `aria-invalid`/`aria-describedby` plus a Sonner toast summary.
- **Timetable** — Calendar and Simple mode toggle, week navigation via `?week=` and `?mode=` params. Calendar view uses absolute positioning for task blocks; overlapping tasks get side-by-side columns. Status colours: gray = TODO, amber = IN_PROGRESS, green = DONE, red = SKIPPED.
- **Fixed toolbar / scroll containment** — `h-dvh` on `SidebarProvider` + `overflow-hidden` on `SidebarInset` keep the body from scrolling so toolbars can stay visually fixed. The `<main>` element is the actual scroll container. Child pages that need a pinned toolbar use `flex flex-col h-full` on their root, a static `<Toolbar>` at the top, and a `flex-1 overflow-auto` div below it for the scrollable list. Negative horizontal margins on the scrollable div cancel `<main>`'s padding so the list extends edge-to-edge.
- **Template editor** — Two view modes (Calendar / Simple) toggled via a segmented control and persisted in `localStorage`. **Calendar** mode shows a drag-and-drop time grid; tasks are dragged from a sidebar panel (desktop) or a bottom sheet (mobile); adaptive column count based on container width via `ResizeObserver`. **Simple** mode shows a day-by-day table sorted by start time; clicking a row opens an inline popup to adjust time and assignees. Both modes share day/week navigation and +/− cycle-length controls.
- **Template list management** — MANAGE_TASKS holders see a ··· dropdown on each template (card and list view) with Rename (inline Dialog), Duplicate ("Copy of …" with collision suffix), and Delete (AlertDialog confirmation). Mutations call `revalidatePath` so the list refreshes without a full reload.
- **Task descriptions** — Task descriptions are stored as GFM markdown and rendered via `react-markdown` + `remark-gfm` on the task detail page. The task list (card and table views) strips markdown via a lightweight `stripMd()` helper for plain-text previews.
- **Task table** — `TaskTable` client component: search, sort (name/duration/people), role filter, row `···` menu (Edit / Duplicate / Delete with confirm). Clicking the row navigates to the task detail page.
- **Roles page** — System roles show a `system` badge and cannot be deleted; Owner also cannot be edited. Custom roles have a `···` menu with Edit and Delete (AlertDialog). Role create/edit form has a two-column task eligibility picker.
- **Role security** — `createRole` and `updateRole` validate `taskIds` against tasks scoped to `orgId` inside a transaction. Cross-tenant IDs abort the transaction with an `INVALID` error.

## Timetable

### Permission gating

| Feature                                               | Required permission |
| ----------------------------------------------------- | ------------------- |
| View timetable                                        | `VIEW_TIMETABLE`    |
| Drag entries, add from task sidebar, Actions dropdown | `MANAGE_TIMETABLE`  |
| Update a task's status via `···` popup                | any org member      |
| Full edit (time, assignees, delete) via `···` popup   | `MANAGE_TIMETABLE`  |

### Role filter

A **Filter** dropdown in the toolbar lets users narrow the timetable to tasks whose `TaskEligibility` includes a selected role. The filter is stored in the URL (`?roleId=`) so it persists across week navigation.

### Skip display

Any `TODO` entry whose local date is before today (org timezone) is displayed as `SKIPPED` in both Calendar and Simple views without mutating the database.

### `···` popup (CalendarEditPopup)

Every timetable block has a `···` menu button. Clicking it opens a Dialog:

- **All members** — can update the task's status.
- **MANAGE_TIMETABLE holders** — additionally see a time input, an assignee list, and a Delete button.

### UTC storage model

Live `TimetableEntry` rows are stored in UTC (`date` = UTC midnight, `startTimeMin`/`endTimeMin` = UTC minutes from that midnight). The server page converts to the org's local timezone before passing instances to the client. Template entries remain in local wall-clock minutes and are converted on `applyTemplate`.

`endTimeMin` is capped at 1440 (= 24:00 midnight) to support 24/7 schedules.

## Seed Data

### Dev seed (`pnpm seed` / `pnpm seed:dev`)

Creates 3 sample organizations each with realistic data:

| Org            | Owner  | Members                       | Custom roles                  | Tasks |
| -------------- | ------ | ----------------------------- | ----------------------------- | ----- |
| Donut Shop A   | Ivan   | Jordan, Casey, Riley, Alex    | Fryer Operator, Counter Staff | 6     |
| Coffee House B | Ivan   | Riley, Morgan, Jordan, Taylor | Head Barista, Kitchen Hand    | 6     |
| Bakery C       | Jordan | Casey, Riley, Morgan, Sam     | Head Baker, Pastry Chef       | 6     |

All orgs also have Owner and Default Member system roles. Members can hold multiple roles. Each org has a timetable template and ~14 historical timetable entries plus today and tomorrow entries.

Users: Ivan, Jordan, Casey, Riley, Morgan, Alex, Taylor, Sam.

### Walker's Doughnuts one-off seed

`scripts/seed-walkers-doughnuts.ts` is a standalone seed for the Walker's Doughnuts org (60 tasks — frappes, hot drinks, food prep, cleaning). Task descriptions are written in GFM markdown (ingredients, method steps, notes).

```bash
# First run — creates the org from scratch
npx tsx scripts/seed-walkers-doughnuts.ts

# Re-run (safe) — upserts roles/permissions/membership and replaces all tasks
npx tsx scripts/seed-walkers-doughnuts.ts

# Full reset — deletes the org and all related data, then recreates from scratch
npx tsx scripts/seed-walkers-doughnuts.ts --reset
```

The script reads `DATABASE_URL` from `.env` (then `.env.local` override). The owner email defaults to `E2E_TEST_USER_EMAIL` or `ivan@example.test`.

## Testing

```bash
# Unit tests (Vitest)
pnpm test
pnpm test:watch
pnpm test:coverage

# Scoped unit test runs
pnpm test:services
pnpm test:validators
pnpm test:actions
pnpm test:api

# Integration tests (Vitest — hits the real dev database; reseeds before each run)
pnpm test:integration

# E2E tests (Playwright — requires a running dev server and seeded DB)
pnpm test:e2e
```

Integration tests live in `__tests__/integration/` and run sequentially against the live dev database (`DATABASE_URL`). They require `INTEGRATION_TEST_USER_EMAIL` (or fall back to the seed user). The global setup reseeds the dev database before each run to guarantee a clean baseline.

| Test file                                                      | Service covered                  | Tests |
| -------------------------------------------------------------- | -------------------------------- | ----- |
| `__tests__/integration/lib/services/orgs.test.ts`              | `orgs.ts`                        | 2     |
| `__tests__/integration/lib/services/memberships.test.ts`       | `memberships.ts`                 | 6     |
| `__tests__/integration/lib/services/roles.test.ts`             | `roles.ts`                       | 7     |
| `__tests__/integration/lib/services/tasks.test.ts`             | `tasks.ts`                       | 8     |
| `__tests__/integration/lib/services/timetable-entries.test.ts` | `timetable-entries.ts`           | 14    |
| `__tests__/integration/lib/services/assignees.test.ts`         | `assignees.ts`                   | 8     |
| `__tests__/integration/lib/services/templates.test.ts`         | `templates.ts`                   | 18    |
| `__tests__/integration/lib/services/invites.test.ts`           | `invites.ts`                     | 11    |
| `__tests__/integration/lib/services/bots.test.ts`              | `bots.ts`                        | 13    |
| `__tests__/integration/lib/services/audit-log.test.ts`         | `audit-log.ts`                   | 6     |

CI runs on every push/PR to `master` via GitHub Actions (`.github/workflows/ci.yml`):

1. **check** job — type-check, lint, unit tests (no DB required)
2. **e2e** job (needs `check`) — spins up a Postgres 16 service container, runs migrations + dev seed, then runs Playwright against the Next.js dev server

Playwright test state is saved to `playwright/.auth/` (gitignored). The `global.setup.ts` skips reseeding when `CI=true` (already seeded by the workflow).

## Docs

The `docs/` folder contains long-form documentation that doesn't belong in this README:

| Path                                         | Description                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `docs/v1/UAT.md`                             | User Acceptance Testing checklist for the v1 feature set |
| `docs/v1/v1-smoke-test/smoke-test-{1..4}.md` | Manual smoke test reports run against production         |

## Observability

Error monitoring and performance tracking is handled by **Sentry** via `@sentry/nextjs`.

- **Error monitoring** — unhandled exceptions on server, edge, and client are captured with full stack traces and request context
- **Performance tracing** — distributed traces across server actions, API routes, and the client; `tracesSampleRate: 1` in development (lower this in production)
- **Session Replay** — video-like reproduction of user sessions leading up to an error (10% of sessions sampled; 100% on error)
- **Logs** — server-side logs forwarded to Sentry via `enableLogs: true`
- **Source maps** — uploaded at build time via `withSentryConfig`; requires `SENTRY_AUTH_TOKEN` in Vercel env vars
- **Global error boundary** — `app/global-error.tsx` catches top-level React errors and reports them before rendering the fallback UI

Sentry config files:

| File                        | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `sentry.server.config.ts`   | Server-side init (tracing, logs, PII)                    |
| `sentry.edge.config.ts`     | Edge runtime init                                        |
| `instrumentation.ts`        | Next.js instrumentation hook (wires server/edge configs) |
| `instrumentation-client.ts` | Client-side init (tracing, replay, logs)                 |

Required env var for source map uploads:

```env
SENTRY_AUTH_TOKEN=   # Required whenever source maps are uploaded at build time (e.g., in CI/CD or on hosting platforms such as Vercel)
                     # Source map upload is performed by withSentryConfig during build
```

## Status

Work in progress. Fully implemented: service layer (all 10 services with 93 integration tests), REST API, auth, member management (list, view, edit, restrict, delete), task management (list, view, create, edit with color), timetable view (calendar + simple, task links), timetable templates (create, rename, duplicate, delete, calendar/simple editor, cycle-length controls, apply to timetable), org settings, role management (list, create, edit, delete, task eligibility, color), franchise management, required colors on tasks and roles, async breadcrumbs with name resolution, fixed-toolbar scroll containment on members and tasks pages, audit log (DB table + Zod-validated service layer, all significant mutations instrumented — UI pending).

Not yet started: schedule generation (automatic cycle-based rotation), worker "Today" checklist, completion stats, timetable/notification settings pages, real-time notification refresh, audit log UI (activity feed page).

Implemented: acceptance notification back to inviter (see `notifyInviteAccepted` in `lib/services/invites.ts`).
