---
title: Operations
description: Audit trails, monitoring, cleanup, and rate limiting
order: 10.5
---

This page covers cross-cutting concerns that support the app but are not core product data.

## Audit trail

- `AuditLog` records significant org mutations.
- `lib/services/audit-log.ts` writes entries and reads them back newest-first.
- Audit writes never block the user flow when called outside a transaction; failures are logged to Sentry.
- Each entry stores the actor, target, before/after snapshots, and optional metadata.

## Monitoring

- Sentry handles error monitoring, performance tracing, session replay, and server-side logs.
- `SENTRY_AUTH_TOKEN` is only needed when build-time source map upload is enabled.

## Rate limiting

- Upstash Redis + `@upstash/ratelimit` powers the sliding-window limits in `proxy.ts`.
- Auth callback/signin requests are rate-limited by IP.
- Authenticated API requests and server actions are rate-limited by user id, falling back to IP.
- If Redis env vars are missing, rate limiting fails open in local/dev.

## Cleanup and retention

- Demo sessions are isolated and expire automatically.
- `pnpm seed:clean` removes only your own namespaced seed data.
- Namespace-aware seeding keeps contributor data separate when a dev database is shared.

## Notes

- `AuditLog` is a database model; Sentry and Redis are architecture concerns.
- For the core schema, see [Data Models](/doc/database/models).