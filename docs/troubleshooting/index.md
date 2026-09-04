---
title: Troubleshooting
description: Fixes for the problems contributors hit most often
order: 13
---

Most local problems trace back to `.env.local`, the local database, or a stale Prisma client. Start here before opening an issue.

## App won't start / build fails

- Re-check `.env.local` against [Environment Variables](/doc/environment-variables) — `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL` are required for a basic boot.
- Run `pnpm prisma generate` if types look stale after pulling schema changes.
- Run `pnpm install` again if a dependency is missing after a pull.

## Database

- **Port `5432` already in use**: stop the other Postgres service, or map the Docker container to a different host port and update `DATABASE_URL` to match.
- **Schema drift / migration errors**: re-run `pnpm prisma migrate dev`. See [Migrations and Seeding](/doc/getting-started/migrations).
- **Seed looks stale or wrong**: `pnpm seed` is destructive for the current `SEED_NAMESPACE` because it clears that namespace before reseeding. Use a disposable namespace for routine reseeds, and use `pnpm seed:clean` when you only want to remove your own namespaced data.

## Auth / sign-in

- **Session loops or immediately signs out**: usually a missing/incorrect `AUTH_SECRET` or `AUTH_URL`, or an `AUTH_SECRET` that doesn't match between environments (this also affects the mobile app — see [Mobile Authentication](/doc/mobile-app/authentication)).
- **OAuth sign-in fails locally**: OAuth is optional in development — leave `AUTH_APPLE_ID`/`AUTH_APPLE_SECRET` and `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` blank and use the seeded dev-user picker on the sign-in page instead.
- **Native Apple Sign In fails on mobile**: Set `AUTH_APPLE_MOBILE_CLIENT_ID` to the mobile bundle ID (`com.ivantran2001.friendchisemobileapp`) so the backend can verify the Apple identity token audience.

## Demo sessions

- **Demo button returns an error / 429**: the demo pool has a concurrency cap (see [Task System](/doc/task-system) and [Operations](/doc/backend-api/operations)); wait for an existing demo session to expire and retry.
- **Mobile demo/dev sign-in link doesn't work**: dev and demo credential flows are only registered when `NODE_ENV === "development"` — they will not work against a production build.

## Uploads / images

- **Uploads fail or images don't render**: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` are required for any upload/logo/task-image flow — see [Environment Variables](/doc/environment-variables) and [Image Handling](/doc/features/image-handling).

## Still stuck

- Run the [Smoke Test](/doc/troubleshooting/smoke-test) to isolate whether the issue is setup-wide or feature-specific.
- Open an [issue](https://github.com/IvanTran-2001/FriendChise/issues) with what you tried from this page.

## TODO

- [ ] Add known Sentry/Upstash Redis local-dev quirks once they come up often enough to document.
