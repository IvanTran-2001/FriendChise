---
name: 🟡 Intermediate
about: Contributor-friendly task with setup notes, requirements, and submission checklist
title: "🟡 [Good First Issue] Add a Logs sidebar to the admin panel"
labels: enhancement, Intermediate, help wanted, UI, good first issue
---

# 🟡 Good First Issue: Add a Logs sidebar to the admin panel
**Time:** ~1-2 hours

**Difficulty:** Good First Issue

**Skill Level:** Contributors comfortable with admin UI and data filtering

Add a new `Logs` section to the admin panel so admins can browse audit logs in a simple list view, search logs, and filter by day or month.

## ⭐ Before You Start
If you enjoy the project, please consider starring the repository. Every star helps support future development and encourages more open-source contributions.
If you need setup help, start here: https://friendchise.app/doc/development/quick-start
To claim this issue, comment with `I want to take this`.

---

## 📌 Description
Build an admin logs page that shows audit log entries in UTC, with a sidebar entry for `Logs`. The page should support searching and selecting a specific day or month.

---

## 🎯 Requirements

- Add a new `Logs` sidebar item in the admin panel.
- Show logs as a list.
- Allow searching through logs.
- Allow filtering by day or month.
- Show all dates and times in UTC.
- Keep the UI simple and readable.

---

## ✅ Expected Result
Admins should be able to:

- Open the Logs section from the admin sidebar.
- Search for log entries.
- Filter logs by a day or a month.
- Read timestamps in UTC.

---

## 🚀 Quick Info
| Category | Details |
| --- | --- |
| Difficulty | Good First Issue |
| Time | ~1-2 hours |
| Focus | Admin UI, filtering, logs |
| Tech | React, Next.js, Prisma |
| Good For | Contributors with some UI + data experience |

---

## 💡 Note
Likely files:
- `app/admin/layout.tsx`
- `app/admin/_components/admin-nav-tabs.tsx`
- `app/admin/page.tsx`
- `lib/services/audit-log.ts`