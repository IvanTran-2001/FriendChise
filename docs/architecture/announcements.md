---
title: Announcements
description: Announcements route, ownership, and data flow for contributors
order: 10.8
---

Announcements is an owner-gated feed with a detail page and sidebar actions.

## Routes

- `app/(app)/orgs/[orgId]/announcements/page.tsx` renders the feed.
- `app/(app)/orgs/[orgId]/announcements/[announcementId]/page.tsx` renders a single announcement.
- `app/(app)/orgs/[orgId]/announcements/layout.tsx` wires the page sidebar shell.

## Ownership

- The list page uses `requireOrgOwnerPage()`.
- Owner-only actions stay hidden in the sidebar and card overflow menu.
- Members can still view a direct announcement URL in read-only mode.

## UI

- The feed uses cards, pagination, and a card-first layout.
- Owners can open edit mode in the ActionSidebar.
- The overflow menu supports edit, extend expiry, and delete.

## Data Flow

- `lib/services/announcements.ts` owns queries and mutations.
- `app/actions/announcements.ts` handles auth, `FormData`, and revalidation.
- The feed uses `getAnnouncementsPage()`; the detail page uses `getAnnouncementById()`.

## Notes

- New announcements default to a one-day expiry.
- Expiry can be extended by one day from the menu.