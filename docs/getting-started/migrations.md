---
title: Migrations and Seeding
description: Prisma migration and seed workflow for local and production environments
order: 7
---

## Prisma workflow

```bash
# Create and apply a new migration to developer database
pnpm prisma migrate dev --name my_migration_name

# Regenerate the Prisma client after schema changes
pnpm prisma generate

# Apply pending migrations to the production database
pnpm migrate:prod

# Seed the database
pnpm seed

# Remove just your namespaced seed data from the shared dev database
pnpm seed:clean
```

## Important safety notes

- `pnpm seed` automatically clears the current namespace before reseeding.
- Never run `pnpm prisma migrate deploy` directly because it can pick up `.env.local`.
- Always use `pnpm migrate:prod` for production migration deployment.
- `pnpm seed:clean` uses the same `SEED_NAMESPACE` resolution as `pnpm seed`.
- Before using `prisma migrate resolve --applied`, verify every missing migration change is already present in production, including columns, indexes, constraints, and data backfills. Then run `pnpm migrate:prod` so any later pending migrations still apply.

## Adding a new model

1. Add the model to `prisma/schema.prisma`.
2. Create the migration with `pnpm prisma migrate dev --name my_migration_name`.
3. Deploy to CI automatically.
4. If production already has the table, verify the missing schema and data changes first, resolve the migration as applied, and then run `pnpm migrate:prod`.
