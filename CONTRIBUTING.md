# Contributing to FriendChise

Thanks for helping improve FriendChise. This repo is a shared dev environment, so the main goal is to keep changes isolated, reproducible, and easy to review.

## Start here: discuss ideas before coding

Before opening a PR, please open a GitHub issue first to discuss your idea with maintainers. This helps ensure alignment, avoids duplicate work, and saves you time.

Not sure what to work on? See [docs/contributing/ideas-for-contribution.md](docs/contributing/ideas-for-contribution.md) for examples across performance, security, UI/UX, services, and more.

## Before you start

1. Install dependencies with `pnpm install`.
2. Create your own Supabase project if you are contributing code.
3. Create or update `.env.local` with your database URL and optional test overrides.
4. **Set up your database**:
   - `pnpm prisma migrate deploy` — apply all migrations to your dev database
   - `pnpm prisma generate` — regenerate Prisma client (usually automatic, but safe to run)
   - `pnpm seed` — seed the database with test data
5. Keep `.env` for production/deployment settings and `pnpm migrate:prod`.
6. (Optional) Set `SEED_NAMESPACE` in `.env.local` only if you're sharing a dev database with other trusted contributors — otherwise it defaults to your git user.name.

**Note**: OAuth (Google/LinkedIn) is optional for local development. In dev mode, you can sign in directly as any seeded user. The sign-in page displays a searchable list of all seeded users with their roles — just click any user to sign in instantly, no password needed.

Seeded user emails are automatically namespaced (e.g., `owner+yourname@example.test`). Available users: owner, jordan, casey, riley, morgan, alex, taylor, sam, quinn. See [prisma/seeds/users.ts](prisma/seeds/users.ts) for full details.

### Minimal `.env.local` example

**Quick setup**: Run `npx auth secret` to generate a random `AUTH_SECRET`, then fill in the template below with your Supabase credentials.

```env
# ===== REQUIRED =====

# Database — create your own Supabase project
DATABASE_URL=postgresql://postgres:your-password@your-project.pooler.supabase.com:5432/postgres

# Auth — generate via: npx auth secret
# Documentation: https://authjs.dev/getting-started/installation
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000

# Supabase — from your project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
SEED_DEV_IDENTIFIERS=your-project.pooler.supabase.com

# ===== OPTIONAL =====

# OAuth (leave blank to use dev sign-in with seeded users)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Sentry (error tracking, optional for local dev)
NEXT_PUBLIC_SENTRY_DSN=

# Upstash Redis (rate limiting, optional for local dev)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Seed namespace (only needed if sharing a dev database with collaborators)
# Defaults to your git user.name or system username
# SEED_NAMESPACE=your-name
```

### Preparing your database

After creating `.env.local` with your Supabase credentials, prepare your database:

```bash
# Apply all migrations to your database
pnpm prisma migrate deploy

# Generate the latest Prisma client (usually runs automatically)
pnpm prisma generate

# Seed with test data — creates users, orgs, tasks, and templates
pnpm seed

# Verify everything works
pnpm dev
```

If migrations fail or your database schema is out of sync, reset and re-apply:

```bash
# WARNING: This deletes all data in your dev database
pnpm prisma migrate reset

# Then seed again
pnpm seed
```

## Common commands

- `pnpm dev` - start the app locally.
- `pnpm seed` - reseed the current namespace.
- `pnpm seed:clean` - remove just your namespaced seed data.
- `pnpm test` - run the full Vitest suite.
- `pnpm test:integration` - run integration tests.
- `pnpm test:e2e` - run Playwright E2E tests.
- `pnpm lint` - run ESLint.
- `pnpm exec tsc --noEmit` - run a typecheck.

## Database and seed workflow

- `pnpm seed` clears the current namespace before reseeding, so repeated runs should not touch another contributor's data.
- Use `SEED_NAMESPACE=<your-name-or-fork>` when you are sharing a dev database with trusted collaborators.
- Use `SEED_NAMESPACE=random` for a disposable one-off run.
- Keep dev/test-only secrets in `.env.local`; use `.env` for deployment-specific values.
- Do not point seed commands at production data.
- If you change Prisma models, generate a migration with `pnpm prisma migrate dev --name <migration-name>`.

If you are not intentionally sharing a dev database with the repo owner, use your own Supabase project and keep it isolated in `.env.local`.

## Tests

- E2E and integration tests depend on the seeded dev database.
- Keep test-created data namespaced or disposable so cleanup can remove it safely.
- If you add a new test flow that creates organizations or other long-lived rows, make sure teardown or cleanup covers it.

## Pull requests

- Keep PRs focused on one change when possible.
- Include tests for behavior changes.
- Update docs when setup, commands, or contributor flow changes.
- Avoid unrelated refactors in the same PR.

## Sign-in options

- **Production**: Use OAuth (Google/LinkedIn) via `AUTH_GOOGLE_*` and `AUTH_LINKEDIN_*` env vars.
- **Local development**: Sign in as a seeded user instantly:
  1. Go to the sign-in page
  2. Scroll to the "Dev — sign in as seeded user" section
  3. Click any user from the list (search to filter by name or role)
  4. Instantly signed in — no password or email entry needed
  5. Available users: owner (MainDev), jordan (Shift Lead), casey (Fryer Op), riley (Shift Lead + Fryer), alex (Trainee), morgan, taylor, sam, quinn

## Security and secrets

- Never commit `.env`, `.env.local`, or real credentials.
- Keep Supabase, Sentry, Upstash, and OAuth secrets local to your environment.
- OAuth env vars can be left blank for local development — use the dev sign-in instead.
- If you discover a security issue, report it privately instead of opening a public issue.
