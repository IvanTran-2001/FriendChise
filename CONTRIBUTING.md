# Contributing to FriendChise

Thanks for helping improve FriendChise.

If this project helps you, please star the repo, follow my work, and share it.

## 1. Start with a plan

Open a GitHub issue before a PR if the change is larger than a small bug fix. That keeps the work focused and avoids duplicate effort.

If you are looking for ideas, see [Ideas for Contributing](https://friendchise.app/doc/contributing/ideas-for-contribution).

## 2. Use the right setup path

Follow [Quick Start](https://friendchise.app/doc/development/quick-start). That guide shows the exact local path, including Docker commands for macOS/Linux and Windows:

- fork and clone the repo
- start a local Postgres database with Docker or a native install
- create `.env.local` with `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`
- generate `AUTH_SECRET` with `npx auth secret` if needed
- run migrations, generate Prisma, and seed
- start the app
- open `/signin` and use a seeded user or the demo flow

If you are working against a shared Supabase-backed environment, keep the same env vars in `.env.local` and provision that database separately.

## 3. Local env

Create or update `.env.local` in the repo root.

Minimum values for local UI work:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/friendchise
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000
```

If you are using a shared dev database, also set:

- `SEED_NAMESPACE` to keep your seed data isolated
- `SEED_DEV_IDENTIFIERS` if you need the safety checks for non-local databases

Generate `AUTH_SECRET` once if needed:

```bash
npx auth secret
```

## 4. Set up the database

Run these commands in order:

```bash
pnpm install
pnpm prisma migrate dev
pnpm prisma generate
pnpm seed
```

If you already restored a snapshot that contains data, `pnpm seed` is still safe to run and will namespace the seed data for your local environment.

If the schema is out of sync, rerun `pnpm prisma migrate dev`.

## 5. Start the app

```bash
pnpm dev
```

Then open `/signin` and use either:

- the seeded dev user picker
- the demo button for an isolated demo org

No app password is required.

## 6. Working rules

- Keep `.env.local` private. Never commit it.
- Keep production secrets out of the repo.
- Do not point seed commands at production data.
- Use `SEED_NAMESPACE=random` for disposable local runs.
- Use `pnpm seed:clean` if you need to remove only your namespaced seed data.
- Keep the Supabase storage vars set before running the app locally if you need logos, images, or uploads.
- If you change Prisma models, create a migration with `pnpm prisma migrate dev --name <migration-name>`.

## 7. Testing

- `pnpm test` runs the Vitest suite.
- `pnpm test:integration` runs integration tests.
- `pnpm test:e2e` runs Playwright.
- `pnpm lint` runs ESLint.
- `pnpm exec tsc --noEmit` runs a typecheck.

E2E and integration tests depend on seeded data, so keep new test data namespaced or disposable.

## 8. Pull requests

- Keep PRs focused on one change when possible.
- Include tests for behavior changes.
- Update docs when setup or contributor flow changes.
- Avoid unrelated refactors in the same PR.
