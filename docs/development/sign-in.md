---
title: Local Sign-In
description: How to access seeded users without OAuth
order: 5
---

In development mode, you can sign in directly as any seeded user without OAuth.

## Steps

1. Go to the sign-in page.
2. Select the **Dev** option.
3. Enter a seeded user email.
4. You will be signed in immediately without a password.

## Example emails

- `owner+yourname@example.test`
- `riley+yourname@example.test`

## Available seeded users

- `owner`
- `jordan`
- `casey`
- `riley`
- `morgan`
- `alex`
- `taylor`
- `sam`
- `quinn`

See [prisma/seeds/users.ts](../../prisma/seeds/users.ts) for the full seeded user setup.
