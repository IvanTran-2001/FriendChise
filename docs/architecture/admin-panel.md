---

title: Admin Panel

order: 18.5

---
Route: `/admin/feedback`

Access is controlled by the `AdminUser` table. To grant admin access, insert a row:

```sql
INSERT INTO "AdminUser" (id, email, "createdAt")
VALUES (gen_random_uuid(), LOWER(TRIM('your@email.com')), now());
```

Note: Emails are stored in normalized form (trimmed and lowercased) for consistent lookups.

The panel shows all feedback with type badges, user email, org name, timestamp, message, and screenshot thumbnail. Items can be marked reviewed/unreviewed (optimistic UI).
