---
name: 🟡 Intermediate
about: Contributor-friendly task with setup notes, requirements, and submission checklist
title: "🟡 [Intermediate] Add a Logs sidebar to the admin panel"
labels: enhancement, Intermediate, help wanted, UI
---

# 🟡 Intermediate: Add a Logs sidebar to the admin panel
**Difficulty:** Intermediate

**Skill Level:** Contributors comfortable with admin UI and basic filtering

Add a `Logs` section to the admin panel so admins can browse audit logs, search entries, and filter by day or month.

## ⭐ Before You Start
If you need setup help, start with quick-start: https://friendchise.app/doc/development/quick-start
To claim this issue, include `I want to take this` anywhere in your comment. If you run into issues, leave a comment on the thread anytime you wish.

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
- Keep the UI simple, readable, and consistent with the existing admin layout.

---

## ✅ Expected Result
Admins should be able to:

- Open the Logs section from the admin sidebar.
- Search for log entries.
- Filter logs by a day or a month.
- Read timestamps in UTC.

---

## 💡 Note
Likely files:
- `app/admin/layout.tsx`
- `app/admin/_components/admin-nav-tabs.tsx`
- `app/admin/page.tsx`
- `lib/services/audit-log.ts`