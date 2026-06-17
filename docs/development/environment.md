---
title: Environment Setup
description: Required variables and local override guidance
order: 4
---

Local development and tests read `.env.local` first, so put your local `DATABASE_URL`, seed namespace, and test overrides there. Keep `.env` for production/deployment settings and `pnpm migrate:prod`.

## Required environment variables

```env
AUTH_SECRET=           # generate with: npx auth secret
AUTH_URL=              # e.g. http://localhost:3000
DATABASE_URL=          # PostgreSQL connection string

# OAuth (optional for local dev — use dev sign-in with seeded users instead)
AUTH_GOOGLE_ID=        # Google OAuth client ID (leave blank for local testing)
AUTH_GOOGLE_SECRET=    # Google OAuth client secret (leave blank for local testing)

# Sentry — error monitoring (get from sentry.io > Settings > Auth Tokens)
SENTRY_AUTH_TOKEN=

# Upstash Redis — rate limiting (get from console.upstash.com > your database > REST API)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Supabase Storage — file uploads (org logos, task images, feedback screenshots)
# Get from Supabase dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=       # e.g. https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=            # Supabase service role key
```

## Optional / local overrides (`.env.local`)

```env
SEED_NAMESPACE=          # optional seed namespace; defaults to your git/user name, or use "random" for a throwaway run
E2E_TEST_USER_EMAIL=      # optional seeded Riley override (defaults to namespaced riley@example.test)
SEED_DEV_IDENTIFIERS=     # comma-separated DB hostnames/usernames allowed for seed/cleanup safety checks
ADMIN_EMAIL=              # (legacy) super-admin email override — superseded by the AdminUser DB table

# OAuth (optional — in dev mode, sign in using seeded user emails instead)
AUTH_GOOGLE_ID=        # leave blank to skip Google OAuth in local development
AUTH_GOOGLE_SECRET=    # leave blank to skip Google OAuth in local development
```

## Example `.env.local` for contributors

```env
# ===== REQUIRED =====

# Database — create your own Supabase project
DATABASE_URL=postgresql://postgres:your-password@your-project.pooler.supabase.com:5432/postgres

# Auth — generated via: npx auth secret
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

# Seed namespace (optional, skip if using your own Supabase)
SEED_NAMESPACE=your-name
```

## Notes

- Use `SEED_NAMESPACE=random` for disposable one-off seeds.
- If you intentionally share a dev database, set `SEED_NAMESPACE` per person or per fork.
- See the [Getting Started](/doc/overview/getting-started) page for the quick setup flow.
