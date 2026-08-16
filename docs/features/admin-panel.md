---

title: Admin Panel

order: 18.5

---
Route: `/admin`

The admin area is split into an overview page plus dedicated growth, feedback, and photos pages.

- The overview page shows feedback counts, a user growth summary, demo launch counts, and a link to the growth page.
- The growth page shows a chart of new users over time, with demo launches tracked separately from real signups.
- The feedback page shows all feedback with type badges, user email, org name, timestamp, message, and screenshot thumbnail.

Access is controlled by the `AdminUser` table. To grant admin access, insert a row:

```sql
INSERT INTO "AdminUser" (id, email, "createdAt")
VALUES (gen_random_uuid(), LOWER(TRIM('your@email.com')), now());
```

Note: Emails are stored in normalized form (trimmed and lowercased) for consistent lookups.

Items can be marked reviewed/unreviewed (optimistic UI).
