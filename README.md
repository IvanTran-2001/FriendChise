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

| Model | Description |
|---|---|
| `Organization` | Top-level tenant. Owns all other resources. |
| `User` | A user account, identified by email. |
| `Membership` | Join table linking a `User` to an `Organization`, with an optional `Role`. |
| `Role` | An org-scoped role (e.g. Manager, Worker) with a set of permissions. |
| `RolePermission` | Grants a specific `OrgPermission` enum value to a `Role`. |
| `Task` | A reusable task template belonging to an org (title, duration, recurrence constraints). |
| `TaskEligibility` | Links a `Task` to a `Role`, defining which roles can be assigned to it. |
| `TaskCycle` | A planning horizon (e.g. weekly) that groups a set of `TaskInstance`s. |
| `TaskInstance` | A scheduled occurrence of a `Task`, with status, scheduled times, and assignees. |
| `TaskInstanceAssignee` | Links a `Membership` to a `TaskInstance` (many-to-many). |

### Migrations

```bash
# Create and apply a new migration
pnpm prisma migrate dev --name <migration-name>

# Regenerate the Prisma client after schema changes
pnpm prisma generate

# Seed the database
pnpm seed
```

## Status

Work in progress — initial scaffolding and planning.
