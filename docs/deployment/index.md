---
title: Deployment
description: How FriendChise is built, migrated, and shipped to production
order: 8
---

## Web app

- Production is deployed at [friendchise.app](https://friendchise.app).
- Build: `pnpm build` runs `prisma generate && next build --webpack`.
- Start: `pnpm start` (`next start`).
- Error monitoring, performance tracing, session replay, and server-side logs run through **Sentry** (`SENTRY_AUTH_TOKEN` is only needed when build-time source map upload is enabled). See [Operations](/doc/backend-api/operations).

## Database migrations

- Local/dev: `pnpm prisma migrate dev`.
- Production: `pnpm migrate:prod`, which runs `prisma migrate deploy` against `.env` (not `.env.local`) with `SKIP_DOTENV_LOCAL=1`. Do not run `prisma migrate deploy` directly in production — use the `migrate:prod` script so the correct env file is loaded.
- See [Migrations and Seeding](/doc/getting-started/migrations) for the full contributor-facing workflow.

## Environment separation

- `.env.local` is for local development and is never used in production.
- `.env` holds production values and is only read by `pnpm migrate:prod` and the deployed build.
- See [Environment Variables](/doc/environment-variables) for the full variable reference.

## Mobile app (Expo / EAS)

- Builds are managed through EAS (`friendchise-mobile-app/eas.json`), with `development`, `preview`, and `production` build profiles.
- The production build profile points `EXPO_PUBLIC_API_URL` at `https://friendchise.app` so production mobile builds talk to the production web backend.
- iOS bundle identifier / Android package: `com.ivantran2001.friendchisemobileapp`.
- See [Mobile App](/doc/mobile-app) for how the client talks to the backend, and [App Store Review Notes](/doc/app-store-review) for store-submission specifics.

## TODO

- [ ] Document the CI/CD pipeline (what runs on push/PR, what gates a deploy) once formalized.
- [ ] Document the hosting provider and any infra-as-code for the web app's production environment in more detail.
- [ ] Document the EAS submit step (`eas submit`) and any required store credentials/secrets.
