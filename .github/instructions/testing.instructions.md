# Testing and Migration Instructions

Use these rules when validating changes, running package commands, or working with Prisma and seeds.

## Validation Strategy

- Validate the smallest affected surface first.
- Prefer a targeted test command over the full suite when only one file or action changed.
- If a fix touches one action, service, or route, run the matching unit test scope before broader checks.
- If a change spans multiple layers, validate the most failure-prone layer first and expand only if needed.

## Package Commands

- `pnpm test` runs the full Vitest suite.
- `pnpm test:unit` is the same full Vitest suite and can be used interchangeably.
- `pnpm test:actions` runs action unit tests.
- `pnpm test:services` runs service unit tests.
- `pnpm test:validators` runs validator unit tests.
- `pnpm test:api` runs API unit tests.
- `pnpm test:integration` runs the integration Vitest config.
- `pnpm test:e2e` runs Playwright end-to-end tests.
- `pnpm lint` runs ESLint.
- `pnpm build` runs Prisma generate and the Next.js production build.
- `pnpm seed` and `pnpm seed:dev` both run the Prisma seed script.
- `pnpm seed:clean` runs the clean seed reset script.

## Prisma Migrations

- Use the repo's Prisma helpers instead of hand-running raw `prisma migrate` commands when possible.
- For a new development migration, use `prisma-migrate-dev`.
- For a migration-status check, use `prisma-migrate-status`.
- For a dev database reset, use `prisma-migrate-reset` only after confirming it is safe.
- For production deploy migrations, use `pnpm migrate:prod`.
- Treat migrations as code changes: validate the schema impact, then run the narrowest follow-up test that covers the changed model or action.

## Seed Work

- Seed changes should stay consistent with the existing `prisma/seeds/` orchestration structure.
- If a seed script depends on local environment variables, load the env first before running it.
- Validate seed changes with the smallest applicable script or lint check before wider verification.

## Example Behavior

Good:

```text
This change only touches the task action, so run the task unit tests first before anything broader.
```

Good:

```text
For a Prisma schema change, use the repository migration workflow instead of hand-editing generated output.
```

Good:

```text
This seed utility reads local env values, so load the environment before running it.
```

Bad:

```text
Always run the entire test suite for every tiny change.
```

Bad:

```text
Treat schema updates like ordinary code and skip migration validation.
```