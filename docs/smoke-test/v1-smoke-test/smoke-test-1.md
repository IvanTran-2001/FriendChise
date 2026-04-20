# 🔥 Smoke Test Report — V1 Round 1

**Date:** 2026-04-15  
**Tester:** @IvanTran-2001  
**Environment:** Production (Deployed V1)  
**Devices Tested:** Desktop (Chrome), iPhone (Safari), Mobile Browser

✅ PASS · ❌ FAIL · ⚠️ PARTIAL

**Testers:** A = Owner account · B = Default member account (no extra permissions)

---

## Summary

| Result | Count |
|--------|-------|
| ✅ PASS | 24 |
| ⚠️ PARTIAL | 9 |
| ❌ FAIL | 7 |
| **Total** | **40** |

**Overall: ❌ FAIL — 7 items need attention**

---

## Auth & Session

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 1 | Sign in with Google | A | OAuth works, redirects to org list | ✅ PASS | |
| 2 | Sign out + back in | A | Session clears, can re-login | ✅ PASS | |
| 3 | Unauthorized page access | B | Toast shown when blocked | ⚠️ PARTIAL | Redirects but no toast [#61](https://github.com/IvanTran-2001/FriendChise/issues/61) |

---

## Org / Franchise Creation

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 4 | Create org | A | Org appears, owner role auto-assigned | ✅ PASS | |
| 5 | Creator gets owner + default member | A | Both roles assigned on create | ❌ FAIL | Only gets owner [#66](https://github.com/IvanTran-2001/FriendChise/issues/66) |
| 6 | Default member has no permissions | A | Default role is empty | ❌ FAIL | Has permissions it shouldn't [#67](https://github.com/IvanTran-2001/FriendChise/issues/67) |
| 7 | Create org form (mobile) | A | Inputs render correctly | ❌ FAIL | Phone input stretches [#65](https://github.com/IvanTran-2001/FriendChise/issues/65) |

---

## Settings / Organization

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 8 | Edit org settings | A | Name, address, timezone save | ✅ PASS | |
| 9 | Settings page layout | A | Content is centered | ❌ FAIL | Not centered [#79](https://github.com/IvanTran-2001/FriendChise/issues/79) |
| 10 | Settings subroute guard | B | Block access past /settings for non-permitted users | ⚠️ PARTIAL | Individual routes guarded but no catch-all [#62](https://github.com/IvanTran-2001/FriendChise/issues/62) |

---

## Roles

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 11 | Create roles | A | Different names, colors, permissions | ✅ PASS | |
| 12 | Edit role | A | Changes persist | ✅ PASS | |
| 13 | Delete custom role | A | Removed, members lose that role | ✅ PASS | |
| 14 | Role form inputs visible | A | Inputs distinguishable from background | ❌ FAIL | Blend into background [#83](https://github.com/IvanTran-2001/FriendChise/issues/83) |

---

## Tasks

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 15 | Create task | A | Title, color, eligibility, duration | ✅ PASS | |
| 16 | Edit task + redirect | A | Save redirects back to previous page | ⚠️ PARTIAL | Saves but no redirect [#74](https://github.com/IvanTran-2001/FriendChise/issues/74) |
| 17 | Delete task | A | Removed from list and timetable | ✅ PASS | |
| 18 | Task list press feedback | Either | Dark shade on hold/click | ❌ FAIL | No feedback [#73](https://github.com/IvanTran-2001/FriendChise/issues/73) |
| 19 | Task tap behavior (iPhone) | B | Tap should edit status, not time | ❌ FAIL | Opens time editor [#76](https://github.com/IvanTran-2001/FriendChise/issues/76) |
| 20 | Duration/time input | A | Scroll picker for duration + start time | ⚠️ PARTIAL | Uses plain input, not scroll picker [#78](https://github.com/IvanTran-2001/FriendChise/issues/78) |

---

## Timetable

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 21 | View timetable (daily/weekly) | A | Entries show with correct times + colors | ✅ PASS | |
| 22 | Add task to timetable | A | Drag or click to schedule | ⚠️ PARTIAL | Add dialog too small/low on mobile [#77](https://github.com/IvanTran-2001/FriendChise/issues/77) |
| 23 | Change task status | B | TODO → IN_PROGRESS → DONE | ⚠️ PARTIAL | Works but no color feedback [#71](https://github.com/IvanTran-2001/FriendChise/issues/71) |
| 24 | Edit entry date | A | Change date in popup | ❌ FAIL | No date change control [#70](https://github.com/IvanTran-2001/FriendChise/issues/70) |
| 25 | Role-based visibility | B | Only see tasks matching your role | ⚠️ PARTIAL | All tasks visible to everyone [#72](https://github.com/IvanTran-2001/FriendChise/issues/72) |
| 26 | Timetable mobile layout | Either | Week mode renders correctly | ❌ FAIL | Stretched on mobile [#68](https://github.com/IvanTran-2001/FriendChise/issues/68) |
| 27 | Add task on empty timetable | A | Can add when no entries exist | ❌ FAIL | No way to add [#69](https://github.com/IvanTran-2001/FriendChise/issues/69) |
| 28 | Role filter | A | Filter timetable by role | ✅ PASS | |

---

## Timetable Templates

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 29 | Create template | A | Weekly template with entries | ⚠️ PARTIAL | Creates but layout broken on mobile [#93](https://github.com/IvanTran-2001/FriendChise/issues/93) |
| 30 | Apply template | A | Populates timetable from start date | ⚠️ PARTIAL | Works but no warning for past dates [#94](https://github.com/IvanTran-2001/FriendChise/issues/94) |
| 31 | Template guard page | B | Non-permitted user blocked | ❌ FAIL | No guard [#63](https://github.com/IvanTran-2001/FriendChise/issues/63) |

---

## Members

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 32 | Invite member | A | Send invite to Account B | ✅ PASS | |
| 33 | Accept invite | B | Notification → accept → membership created | ✅ PASS | |
| 34 | Decline invite | B | Status updates, shows in history | ✅ PASS | |
| 35 | Invite without role | A | Should auto-assign default member | ⚠️ PARTIAL | Role is required in form [#87](https://github.com/IvanTran-2001/FriendChise/issues/87) |
| 36 | Edit member + redirect | A | Save → redirect back + toast | ⚠️ PARTIAL | Saves but no redirect or toast [#85](https://github.com/IvanTran-2001/FriendChise/issues/85) |
| 37 | Delete member | A | Remove from org | ✅ PASS | |
| 38 | Cannot delete owner | B | Owner removal blocked | ✅ PASS | |

---

## Franchise

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 39 | Send franchise token | A | Token created, invite sent | ✅ PASS | |
| 40 | Join as franchisee | B | Org created with cloned roles/tasks | ✅ PASS | |
| 41 | Transfer franchise ownership | A | New owner sees controls | ⚠️ PARTIAL | Requires app restart [#88](https://github.com/IvanTran-2001/FriendChise/issues/88) |
| 42 | Franchise page guard | B | Non-owner blocked, redirect to overview | ❌ FAIL | Redirects to home instead [#64](https://github.com/IvanTran-2001/FriendChise/issues/64) |

---

## Notifications

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 43 | Bell shows unseen count | B | Red badge appears | ✅ PASS | |
| 44 | Bell clears on click | B | Badge clears, marks seen | ✅ PASS | |
| 45 | Bell refreshes on click | B | Fetches latest notifications | ⚠️ PARTIAL | No refresh, stale data [#81](https://github.com/IvanTran-2001/FriendChise/issues/81) |
| 46 | Sender notified on accept | A | Toast/notification when B accepts | ❌ FAIL | No notification sent [#82](https://github.com/IvanTran-2001/FriendChise/issues/82) |
| 47 | Notification panel (mobile) | B | Panel positioned correctly | ❌ FAIL | Too low on screen [#80](https://github.com/IvanTran-2001/FriendChise/issues/80) |

---

## Navigation & Layout

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 48 | Sidebar persistence | Either | Sidebar stays open between org ↔ settings | ❌ FAIL | Closes on navigate [#84](https://github.com/IvanTran-2001/FriendChise/issues/84) |
| 49 | Org switcher | A | Switch orgs, data changes | ✅ PASS | |
| 50 | Toolbar buttons position | A | Action buttons on right side | ❌ FAIL | On left [#75](https://github.com/IvanTran-2001/FriendChise/issues/75) |

---

## State Persistence

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 51 | Remember timetable mode | A | Daily/weekly persists across nav | ❌ FAIL | Resets [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |
| 52 | Remember task list mode | A | Card/list persists | ❌ FAIL | Resets [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |
| 53 | Remember member view mode | A | Card/list persists | ❌ FAIL | Resets [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |
| 54 | Remember template mode | A | Calendar/simple persists | ❌ FAIL | Resets [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |

---

## Mobile Scroll

| # | Test | As who | What to check | Status | Notes |
|---|------|--------|---------------|--------|-------|
| 55 | Scroll to bottom (mobile) | Either | Page stays at scroll position | ❌ FAIL | Jumps back to top [#60](https://github.com/IvanTran-2001/FriendChise/issues/60) |

---

## Next Steps

1. Fix all ❌ FAIL items first (priority: scroll, mobile layout, guards)
2. Address ⚠️ PARTIAL items
3. Re-run as Round 2
4. Once clean → functional testing