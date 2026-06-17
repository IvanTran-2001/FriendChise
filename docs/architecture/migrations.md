---

title: Migrations

order: 18.5

---

```bash
# Create and apply a new migration
pnpm prisma migrate dev --name <migration-name>

# Regenerate the Prisma client after schema changes
pnpm prisma generate

# Apply pending migrations to the production database
pnpm migrate:prod

# Seed the database
pnpm seed

# Remove just your namespaced seed data from the shared dev database
pnpm seed:clean
```

`pnpm seed` automatically clears the current namespace before reseeding, so repeated runs stay isolated without touching other contributors' data.

> **Never run `pnpm prisma migrate deploy` directly** — it picks up `.env.local` (the dev DB).
> Always use `pnpm migrate:prod`, which explicitly loads `.env` (the production DB) and skips `.env.local`.

`pnpm seed:clean` uses the same `SEED_NAMESPACE` resolution as the main seed command, so it only removes the data for the current contributor/fork namespace.

#### Adding a new model — workflow

```text
1. Add the model to prisma/schema.prisma
2. Create the migration file:
     pnpm prisma migrate dev --name <migration-name>
     # If the local dev DB has drift, use --create-only to generate the SQL without applying:
     pnpm prisma migrate dev --create-only --name <migration-name>
3. Deploy to CI (automatic — prisma migrate deploy runs on every push)
4a. If the table does NOT yet exist in production:
     pnpm migrate:prod
4b. If you already applied via db push (table already exists in production):
     pnpm exec dotenv -e .env -- prisma migrate resolve --applied <migration-name>
     pnpm migrate:prod   # should print "No pending migrations to apply"
```

#### Migration history

| Migration                                                         | Description                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260414033638_init`                                             | Full initial schema — all models, enums, indexes                                                                                                                                                                                                                                                                              |
| `20260414035009_add_invite_metadata`                              | Add `metadata` JSON field to `Invite` for storing roleIds/workingDays for the accept step                                                                                                                                                                                                                                     |
| `20260414045652_add_invite_snapshots`                             | Add snapshot fields (`orgName`, `inviterName`) to `Invite` so cards render without joins                                                                                                                                                                                                                                      |
| `20260415021658_invite_pending_unique`                            | Partial unique index on `Invite(orgId, recipientId, type)` where `status = 'PENDING'` — DB-level guard against duplicate pending invites                                                                                                                                                                                      |
| _(schema push)_                                                   | `AuditLog` model added (`orgId`, `actorId`, `action`, `entityType`, `entityId`, `before`, `after`, `createdAt`). Applied via `pnpm prisma db push` (dev DB had migration drift — no timestamped migration file).                                                                                                              |
| `20260513023554_rename_template_to_timetable_template_add_roster` | Rename `Template`/`TemplateEntry`/`TemplateEntryAssignee` → `TimetableTemplate`/`TimetableTemplateEntry`/`TimetableTemplateEntryAssignee` using `ALTER TABLE ... RENAME TO` (data-safe). Add `RosterEntry` and `RosterDayConfig` tables with shift-time and day-config columns.                                               |
| `20260513030121_add_shift_times_to_roster_entry`                  | Add `shiftStartMin`/`shiftEndMin` (nullable `Int`) to `RosterEntry`.                                                                                                                                                                                                                                                          |
| `20260513031027_add_open_close_time_to_roster_day_config`         | Add `openTimeMin`/`closeTimeMin` (nullable `Int`) to `RosterDayConfig`.                                                                                                                                                                                                                                                       |
| `20260513122627_add_roster_template`                              | Add `RosterTemplate` and `RosterTemplateEntry` tables with cascade deletes and a composite unique index on `(templateId, membershipId, weekIndex, dayIndex)`.                                                                                                                                                                 |
| `20260513123326_roster_template_cycle_weeks`                      | Add `cycleWeeks Int @default(1)` to `RosterTemplate`.                                                                                                                                                                                                                                                                         |
| `20260514000000_add_check_constraints`                            | DB-level CHECK constraints enforcing field bounds: time fields 0–1440, `dayIndex` 0–6, `cycleWeeks` 1–12.                                                                                                                                                                                                                     |
| _(schema push)_                                                   | `Feedback` model (`userId`, `orgId?`, `type`, `message`, `imageUrl?`, `reviewed`) and `AdminUser` model (`email unique`) added. Applied via `prisma db push` (dev DB had migration drift).                                                                                                                                    |
| _(schema push)_                                                   | `TaskInheritance` (`taskId`, `orgId`, `inheritedAt`) and `TaskSectionLayout` (`taskId`, `orgId`, `type`, `title`, `scope`, `position`, `visible`) models added. `Task.scope` (`TaskScope` enum, default `ORG`) added. `SectionScope` enum added. Applied via `prisma db push` on the `feat/task-inheritance-sections` branch. |
| _(schema push)_                                                   | `TaskComment` and `TaskCommentVote` models added. `VoteType` enum (`UPVOTE`, `DOWNVOTE`) added. `Task.comments`, `Organization.taskComments`, `User.taskComments`/`taskCommentVotes` relations added. Applied via `prisma db push` on the `feature/task-comment-section` branch.