---
title: Quick Start
description: A concise setup path for local development
order: 3
---

## For contributors

If you are planning to contribute, start by forking the repo on GitHub, then clone your fork locally.

```bash
git clone https://github.com/<your-username>/FriendChise.git
cd FriendChise
```

If you are just exploring the app locally, you can still clone the repo directly. For real development work, use your own Supabase project so your seed data and migrations stay isolated.

## Set up Supabase and local env

1. Create a new Supabase project.
2. Copy the Supabase connection details into `.env.local`.
3. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `SEED_DEV_IDENTIFIERS` (a comma-separated list of allowed DB hostnames/usernames for seed and cleanup safety checks, e.g., `your-project.pooler.supabase.com`).
4. Optionally set `SEED_NAMESPACE` if you are sharing a dev database.

```bash
pnpm install
pnpm prisma migrate deploy
pnpm prisma generate
pnpm seed
pnpm dev
```

## After cloning

1. Install dependencies with `pnpm install`.
2. Apply migrations with `pnpm prisma migrate deploy`.
3. Generate Prisma Client with `pnpm prisma generate`.
4. Seed the database with `pnpm seed`.
5. Start the app with `pnpm dev`.

## After the app starts

1. Open the sign-in page.
2. Use a seeded dev user.
3. Confirm the dashboard loads.

## If something fails

- Re-check `.env.local`.
- Re-run `pnpm seed`.
- Re-run `pnpm prisma migrate deploy`.
