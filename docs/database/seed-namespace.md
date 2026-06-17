---
title: Seed Namespace
description: How namespace-aware seeding prevents contributor collisions
order: 13
---

FriendChise uses namespace-aware seed data so contributors and tests can share a database with less collision risk.

## What it does

- Appends a namespace to seeded emails and display names.
- Clears the current namespace before reseeding.
- Keeps contributor data separate when multiple people share the same dev database.

## Useful commands

- `pnpm seed`
- `pnpm seed:clean`

## Naming

A namespace can come from:

- `SEED_NAMESPACE`
- your git user name
- your system username
- a generated `run-xxxxxxxx` fallback

## Cleanup behavior

- Deletes namespace-scoped orgs.
- Deletes namespace-scoped seeded users.
- Leaves other contributors' data untouched.
