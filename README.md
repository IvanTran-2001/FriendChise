# FriendChise

[![CI](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml/badge.svg)](https://github.com/IvanTran-2001/FriendChise/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org)
[![Deploy](https://img.shields.io/badge/deploy-friendchise.app-brightgreen)](https://friendchise.app)

Improve consistency across franchise operations through shared wisdom, optimal tools, and effective visuals. FriendChise gives parent organizations a single place to manage tasks, timetables, roles, tools, and collaboration across franchise locations.

Production deployment: **[friendchise.app](https://friendchise.app)**

## Links

- Website: [friendchise.app](https://friendchise.app)
- GitHub: [IvanTran-2001/FriendChise](https://github.com/IvanTran-2001/FriendChise)
- Docs: [friendchise.app/doc](https://friendchise.app/doc)
- LinkedIn: [FriendChise company page](https://www.linkedin.com/company/friendchise-app/)

Follow FriendChise on LinkedIn for product updates and launch news.

## Screenshots

| Organizations Hub                                                                                                                                                                                                        | Dashboard                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [![Organizations Hub](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Organizations%20hub%20page.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Organizations%20hub%20page.png) | [![Dashboard](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Org%20Overview%20Page.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Org%20Overview%20Page.png) |

| Timetable                                                                                                                                                                                                  | Timetable (Simple List)                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Timetable](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Timetable-Calender-V2.5.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Timetable-Calender-V2.5.png) | [![Timetable Simple](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Calender%20Simple%20Mode.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Calender%20Simple%20Mode.png) |

| Task Detail                                                                                                                                                                                            | Create Task                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [![Task Detail](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Task%20Detail%20Page.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Task%20Detail%20Page.png) | [![Create Task](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Create-Task-V2.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Create-Task-V2.png) |

| Roles                                                                                                                                                                                                | Members                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Roles](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Settings%20role%20page.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Settings%20role%20page.png) | [![Members](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Member%20List%20Card%20Mode.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Member%20List%20Card%20Mode.png) |

| Tools Hub                                                                                                                                                                            | Conversion Tool                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Tools Hub](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Tools%20Page.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Tools%20Page.png) | [![Conversion](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Conversion%20Entries.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Conversion%20Entries.png) |

| Staff Roster                                                                                                                                                                        | Task Comments                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [![Roster](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Roster%20List.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Roster%20List.png) | [![Task comments](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Task%20Comments.png)](https://ivantran-2001.github.io/projects/pictures/friendchise/V2/Task%20Comments.png) |

## Docs

The full docs now live in the in-app docs site at [friendchise.app/doc](https://friendchise.app/doc).

Key pages:

- [Overview](/doc/overview)
- [Getting Started](/doc/getting-started)
- [Smoke Test](/doc/Smoke%20Test)
- [Contributing](/doc/contributing)
- [Ideas for Contributing](/doc/ideas-for-contribution)
- [Architecture](/doc/architecture)
- [Tech Stack](/doc/stack)
- [Environment Setup](/doc/development/environment)
- [Testing](/doc/development/testing)
- [Migrations and Seeding](/doc/development/migrations)
- [Data Models](/doc/database/models)
- [Support and Community](/doc/support)

## Tech Stack

- Next.js 16.1.6, TypeScript, React 19
- pnpm, Prisma ORM v7, PostgreSQL on Supabase
- Auth.js v5, Tailwind CSS v4, shadcn/ui, Radix UI
- Vitest, Playwright, Sentry, Upstash Redis

## Getting Started

```bash
pnpm install
pnpm prisma migrate dev
pnpm seed
pnpm dev
```

For contributor setup, start with the [Quick Start](/doc/development/quick-start) page. It covers forking, cloning, Supabase setup, and local env configuration.

## Local Sign-In

OAuth is optional in development. You can sign in instantly with seeded users from the dev sign-in page.

- Example: `owner+yourname@example.test`
- Example: `riley+yourname@example.test`

See [Local Sign-In](/doc/development/sign-in) for the full flow.

## Quick Start

```bash
pnpm install
pnpm prisma migrate dev
pnpm seed
pnpm dev
```

For production deployments use `pnpm migrate:prod`.

## Contribute

If you want to help improve FriendChise:

1. Open an issue first to discuss the idea.
2. Check [CONTRIBUTING.md](CONTRIBUTING.md).
3. Read [Ideas for Contributing](/doc/ideas-for-contribution) for examples.
4. Star the repo if you like the project.

## Support

If you are new here, start with the docs site and follow the setup flow from the Getting Started page.

- Docs: [friendchise.app/doc](https://friendchise.app/doc)
- Getting Started: [friendchise.app/doc/getting-started](https://friendchise.app/doc/getting-started)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
