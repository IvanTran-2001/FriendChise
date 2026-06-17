---
title: Testing
description: Unit, integration, and end-to-end testing guidance
order: 6
---

FriendChise uses multiple testing layers so behavior stays reliable as the app grows.

## Test types

- **Vitest** for unit and integration coverage.
- **Playwright** for end-to-end browser flows.
- **TypeScript** for compile-time correctness.

## Commands

```bash
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm exec tsc --noEmit
pnpm lint
```

## Test isolation

- E2E and integration runs use namespace-aware seed data.
- `SEED_NAMESPACE` keeps contributor data isolated when a dev database is shared.
- Test cleanup removes namespaced orgs and users after runs.

## Smoke test

Use the [Smoke Test](/doc/smoke-test) after setup to verify the app and seeded data work end to end.
