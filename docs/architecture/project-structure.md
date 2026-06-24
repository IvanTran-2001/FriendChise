---
title: Project Structure
description: Basic map of the main app areas
order: 18.5
---

This page is intentionally broad. The codebase is the source of truth.

## Access hierarchy

```text
Public
└─ /signin
	├─ seeded dev users
	└─ demo session
		└─ isolated demo org
Signed-in user
	├─ app/(app) shell
	│  ├─ /orgs/[orgId] home
	│  ├─ tools / tasks / timetable / settings
	│  └─ permission-gated actions
	└─ /admin
		└─ super-admin only
```

If you want to get more specific, the hierarchy underneath `app/(app)` usually looks like:

- signed in
- membership in the org
- role permission for the action or page (see [RBAC](/doc/architecture/rbac))
- parent-owner access for franchisor-only screens

## Main areas

- `app/(auth)/signin`: sign-in flow, seeded dev users, and the demo session.
- `app/(app)`: authenticated shell and the main product workspace.
- `app/(app)/orgs/[orgId]`: org home page.
- `app/(app)/orgs/[orgId]/tools`: tools area for item lists, conversions, and roster.
- `app/(app)/orgs/[orgId]/memberships`: members area for invites, bots, and role-based member management.
- `app/(app)/orgs/[orgId]/tasks`, `timetable`, `settings`: the rest of the org workspace.
- `app/admin`: admin overview, growth chart, feedback, and photos.
- `app/api`: small helper routes only.
- `app/actions`: server actions used by the UI.
- `components`: shared layout, sidebar, toolbar, and UI pieces.
- `lib`: auth, RBAC, services, validators, and storage helpers.
- `prisma`: schema and seed data.

## Notes

- Use the route folders in `app/` for route-level detail.
- Use `lib/services/` and `app/actions/` for data flow and mutations.
- `app/api/` only contains the small helper endpoints that are still in use.