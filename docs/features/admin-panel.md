---

title: Admin Panel

order: 18.5

---
Route: `/admin`

The admin area is split into an overview page plus dedicated growth, feedback, and photos pages.

- The overview page shows feedback counts, a user growth summary, demo launch counts, and a link to the growth page.
- The growth page shows a chart of new users over time, with demo launches tracked separately from real signups.
- The feedback page shows all feedback with type badges, user email, org name, timestamp, message, and screenshot thumbnail.

Outside development, access is controlled by the `AdminUser` table. In `NODE_ENV=development`, any signed-in user can reach the admin area without an `AdminUser` row.

To grant admin access in non-development environments, insert a row:

```sql
INSERT INTO "AdminUser" (id, email, "createdAt")
VALUES (gen_random_uuid(), LOWER(TRIM('your@email.com')), now());
```

Note: Emails are stored in normalized form (trimmed and lowercased) for consistent lookups.

Items can be marked reviewed/unreviewed (optimistic UI).
