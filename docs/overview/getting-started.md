---
title: Getting Started
description: Install, configure, and run locally
order: 2
---

## Prerequisites

- Node.js 20+
- pnpm
- A Supabase Postgres project (recommended for local development)

## Quick start

Follow the [Quick Start](/doc/development/quick-start) page for the contributor flow. It covers forking, cloning, Supabase setup, and the local development commands in order.

## Environment setup

Create `.env.local` and add the required values:

```env
DATABASE_URL=postgresql://postgres:your-password@your-project.pooler.supabase.com:5432/postgres
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
SEED_DEV_IDENTIFIERS=your-project.pooler.supabase.com  # Comma-separated DB hostnames/usernames allowed for seed/cleanup safety checks
```

## Local sign-in

In development mode, OAuth is optional. You can sign in as seeded users directly from the sign-in page.

Examples:

- `owner+yourname@example.test`
- `riley+yourname@example.test`

## Next steps

- Read [Contributing](/doc/contributing)
- Review project [Architecture](/doc/architecture)
- Run the [Smoke Test](/doc/smoke-test) after setup
