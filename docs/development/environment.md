---
title: Environment Setup
description: Must-have variables and optional feature-specific settings
order: 4
---

Local development and tests read `.env.local` first. The must-have variables for a basic local boot are `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`. Add seed namespace and feature-specific overrides in the same file only when you need them. Keep `.env` for production/deployment settings and `pnpm migrate:prod`.

## Core variables

```env
AUTH_SECRET=           # generate with: npx auth secret
AUTH_URL=              # e.g. http://localhost:3000
DATABASE_URL=          # PostgreSQL connection string
```

## Service-specific variables

Use these for optional features or specific tests and changes.

### Storage

Optional for logos, task images, and feedback screenshots when your local run needs storage-backed features.

```env
NEXT_PUBLIC_SUPABASE_URL=       # e.g. https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=            # Supabase service role key
```

### Logging

Optional for error monitoring and release tracking.

```env
SENTRY_AUTH_TOKEN=
```

### Rate limiting

Optional for rate limiting and other Redis-backed features.

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Local overrides

```env
SEED_NAMESPACE=          # optional seed namespace; defaults to your git/user name, or use "random" for a throwaway run
E2E_TEST_USER_EMAIL=      # optional seeded Riley override (defaults to namespaced riley@example.test)
SEED_DEV_IDENTIFIERS=     # comma-separated DB hostnames/usernames allowed for seed/cleanup safety checks
ADMIN_EMAIL=              # (legacy) super-admin email override — superseded by the AdminUser DB table
# OAuth (optional — in dev mode, sign in using seeded user emails instead)
AUTH_GOOGLE_ID=        # leave blank to skip Google OAuth in local development
AUTH_GOOGLE_SECRET=    # leave blank to skip Google OAuth in local development
```

## Contributor example

```env
# ===== REQUIRED =====

# Database — local Postgres snapshot or your own Supabase project
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/friendchise

# Auth — generated via: npx auth secret
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000

# ===== OPTIONAL =====

# Supabase storage — required for uploads and image URLs
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# Sentry — error tracking / release health
SENTRY_AUTH_TOKEN=

# Upstash Redis — rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Shared dev database safety (only needed when you are not using a local DB)
SEED_DEV_IDENTIFIERS=

# Seed namespace (optional, skip if using your own database)
SEED_NAMESPACE=your-name

# OAuth (leave blank to use dev sign-in with seeded users)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

## Notes

- Use `SEED_NAMESPACE=random` for disposable one-off seeds.
- If you intentionally share a dev database, set `SEED_NAMESPACE` per person or per fork.
- Set the Supabase storage vars before using pages or actions that render or upload logos and images.
- See the [Getting Started](/doc/contributing/getting-started) page for the quick setup flow.
