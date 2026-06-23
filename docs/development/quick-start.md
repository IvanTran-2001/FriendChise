---
title: Quick Start
description: Exact setup path for contributors
order: 3
---

## 1. Clone the repo

Fork the repo first, then clone your fork locally.

```bash
git clone https://github.com/<your-username>/FriendChise.git
cd FriendChise
```

If you already have the repo open, just use the folder you already cloned.

## 2. Start a local Postgres database

Use Docker if you want the quickest setup. The same Postgres container image works on macOS, Linux, and Windows through Docker Desktop:

```bash
docker run --name friendchise-postgres \
	-e POSTGRES_USER=postgres \
	-e POSTGRES_PASSWORD=postgres \
	-e POSTGRES_DB=friendchise \
	-p 5432:5432 \
	-d postgres:16
```

If you are on Windows PowerShell or Windows Terminal, use the same command with PowerShell line endings:

```powershell
docker run --name friendchise-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=friendchise `
  -p 5432:5432 `
  -d postgres:16
```

If you already have a local Postgres install, use that instead. The important part is that `DATABASE_URL` points to your local database, not Supabase.

## 3. Create `.env.local`

Copy the local database settings into `.env.local` in the repo root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/friendchise
AUTH_SECRET=your-generated-secret-here
AUTH_URL=http://localhost:3000
```

Generate `AUTH_SECRET` once if you do not already have one:

```bash
npx auth secret
```

## 4. Setup

Run the setup commands in order:

```bash
pnpm install
pnpm prisma migrate dev
pnpm prisma generate
pnpm seed
```

If you already restored a snapshot that has data, `pnpm seed` is still safe to run and will namespace the seed data for your local environment.

## 5. Start the app

```bash
pnpm dev
```

## 6. Sign in

Run [localhost:3000](http://localhost:3000/).

1. Click a seeded dev user in the Dev picker.
2. Use the demo button if you want a fresh isolated demo org.

No app password is required. The data you edit goes into your local Postgres database only.

## If something fails

- Re-check `.env.local`.
- Make sure the local Postgres container or service is running.
- If Docker says port `5432` is already in use, stop the other Postgres service or change the host port before starting the container again.
- Re-run `pnpm prisma migrate dev` if the schema is out of sync.
- Re-run `pnpm seed` if you want a fresh local dataset.
- Post an [issue](https://github.com/IvanTran-2001/FriendChise/issues) if you run into any problems not mentioned here.
