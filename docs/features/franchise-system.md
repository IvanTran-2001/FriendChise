---
title: Franchise System
description: How parent orgs create, join, and manage franchisee orgs
order: 10.8
---

FriendChise treats franchising as a first-class org lifecycle, not just an invite flow.

## Parent vs child orgs

For contributors, the key hierarchy rule is `Organization.parentId`:

- If `parentId` is set, the org is a child franchisee org.
- If `parentId` is `null`, the org is the parent/root org.

Use that field when you need to tell whether code should treat an org as the franchisor or one of its franchisees.

## Core flow

1. A franchisor generates a one-time token from the Franchisee page.
2. That token is stored as a `FranchiseToken` with `invitedEmail` and `expiresAt`.
3. The invitee visits `/orgs/new` and submits the token through the `joinFranchise` server action.
4. On success, the new org is created from the parent org and the joining user becomes its Owner.

## What gets cloned

When a franchisee joins, the franchise service copies the operational baseline from the parent org:

- Roles
- Tasks
- Timetable settings

The cloning logic lives in `lib/services/franchise.ts`, which keeps the business rules isolated from the UI and server-action boundary.

## Ownership and control

- The joining user is assigned as the child org's Owner.
- The parent org owner can view child orgs and pending tokens.
- Parent owners can extend or revoke tokens.
- Parent owners can also remove franchisees.

## Related models and routes

- `FranchiseToken` stores the invite token metadata.
- `Organization` represents both the franchise root and each child org.
- `Organization.parentId` distinguishes parent/root orgs from child franchisee orgs.
- `/orgs/new` is the user-facing join entry point.
- `joinFranchise` is the server action that validates and applies the token.
