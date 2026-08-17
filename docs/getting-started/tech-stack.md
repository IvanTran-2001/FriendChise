---
title: Tech Stack
description: The packages and tools FriendChise is built on
order: 10
---
- **Next.js 16.1.6** (App Router, TypeScript, React 19)
- **pnpm** (package manager)
- **PostgreSQL** (Supabase) + **Prisma ORM v7**
- **Auth.js v5 (NextAuth)** — Google OAuth, JWT sessions
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI**
- **Sonner** — toast notifications
- **Zod v4** — schema validation
- **react-markdown** + **remark-gfm** — markdown rendering for docs and task descriptions
- **browser-image-compression** — in-browser image compression before upload
- **react-easy-crop** — in-browser pan/zoom crop editor
- **Vitest** — unit + integration tests
- **Playwright** — E2E browser tests
- **Sentry** — error monitoring, performance tracing, session replay, and server-side logs
- **Upstash Redis** + **@upstash/ratelimit** — sliding-window rate limiting

## Why these choices

- Next.js keeps the app and docs in one deployable system.
- Prisma and Supabase make the data layer portable and easy to provision.
- The UI stack gives polished components without a heavy custom design system.
- Testing, monitoring, and rate limiting are built in from the start.
