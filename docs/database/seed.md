---
title: Seeding
description: High-level overview of how the database seed works
order: 13
---

This page stays deliberately general. The seed files are the source of truth.

## What seeding does

- Creates a repeatable local dataset for development and tests.
- Uses a namespace so multiple contributors can share a database without colliding.
- Seeds users first, then orgs, then follow-up data that depends on those orgs.

## How it works

- `pnpm seed` validates that `DATABASE_URL` points to a local or explicitly allowed dev database.
- The current namespace is cleared before reseeding, so reruns stay predictable.
- The namespace comes from `SEED_NAMESPACE`, or falls back to your git user name, system user name, or a generated run id.
- Seeded emails and display names are namespaced so contributor data stays isolated.

## What gets seeded

- Seed users for sign-in and test flows.
- Demo / sample org data.
- Supporting data that depends on the seeded orgs, such as conversion data and invite fixtures.

## Demo sessions

- The demo button uses a separate runtime seed flow to build one isolated demo org per visitor.
- That demo org is pre-seeded with sample data, then reset automatically after use.
- This is separate from `pnpm seed`, which builds the shared local/test dataset.

## Cleanup

- Use `pnpm seed:clean` when you only want to remove your own namespaced seed data.
- It leaves other contributors' data untouched.

## Notes

- If you need the exact model layout, see [Data Models](/doc/database/models).
- If you need the enum values used by the seed data, see [Enums](/doc/database/enums).

