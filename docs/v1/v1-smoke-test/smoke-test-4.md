# 🔥 Smoke Test Report — V1 Round 4

**Date:** 2026-04-20  
**Tester:** @IvanTran-2001  
**Environment:** Production (Deployed V1)  
**Devices Tested:** Desktop (Chrome), iPhone (Safari), Mobile Browser

✅ PASS · ❌ FAIL · ⚠️ PARTIAL

**Testers:** A = Owner account · B = Default member account (no extra permissions)

---

## Summary

| Result     | Count  |
| ---------- | ------ |
| ✅ PASS    | 64     |
| ⚠️ PARTIAL | 0      |
| ❌ FAIL    | 0      |
| **Total**  | **64** |

**Overall: ✅ PASS — All Round 3 issues resolved**

---

## Auth & Session

| #   | Test                     | As who | What to check                      | Status  | Notes |
| --- | ------------------------ | ------ | ---------------------------------- | ------- | ----- |
| 1   | Sign in with Google      | A      | OAuth works, redirects to org list | ✅ PASS |       |
| 2   | Sign out + back in       | A      | Session clears, can re-login       | ✅ PASS |       |
| 3   | Unauthorized page access | B      | Toast shown when blocked           | ✅ PASS |       |

---

## Org / Franchise Creation

| #   | Test                                | As who | What to check                         | Status  | Notes |
| --- | ----------------------------------- | ------ | ------------------------------------- | ------- | ----- |
| 4   | Create org                          | A      | Org appears, owner role auto-assigned | ✅ PASS |       |
| 5   | Creator gets owner + default member | A      | Both roles assigned on create         | ✅ PASS |       |
| 6   | Default member has no permissions   | A      | Default role is empty                 | ✅ PASS |       |
| 7   | Create org form (mobile)            | A      | Inputs render correctly               | ✅ PASS |       |

---

## Settings / Organization

| #   | Test                    | As who | What to check                                       | Status  | Notes |
| --- | ----------------------- | ------ | --------------------------------------------------- | ------- | ----- |
| 8   | Edit org settings       | A      | Name, address, timezone save                        | ✅ PASS |       |
| 9   | Settings page layout    | A      | Content is centered                                 | ✅ PASS |       |
| 10  | Settings subroute guard | B      | Block access past /settings for non-permitted users | ✅ PASS |       |

---

## Roles

| #   | Test                     | As who | What to check                          | Status  | Notes |
| --- | ------------------------ | ------ | -------------------------------------- | ------- | ----- |
| 11  | Create roles             | A      | Different names, colors, permissions   | ✅ PASS |       |
| 12  | Edit role                | A      | Changes persist                        | ✅ PASS |       |
| 13  | Delete custom role       | A      | Removed, members lose that role        | ✅ PASS |       |
| 14  | Role form inputs visible | A      | Inputs distinguishable from background | ✅ PASS |       |

---

## Tasks

| #   | Test                       | As who | What to check                            | Status  | Notes                                                                 |
| --- | -------------------------- | ------ | ---------------------------------------- | ------- | --------------------------------------------------------------------- |
| 15  | Create task                | A      | Title, color, eligibility, duration      | ✅ PASS |                                                                       |
| 16  | Edit task + redirect       | A      | Save redirects back to previous page     | ✅ PASS |                                                                       |
| 17  | Delete task                | A      | Removed from list and timetable          | ✅ PASS |                                                                       |
| 18  | Task list press feedback   | Either | Dark shade on hold/click                 | ✅ PASS |                                                                       |
| 19  | Task tap behavior (iPhone) | B      | Tap should edit status, not time         | ✅ PASS |                                                                       |
| 20  | Duration/time input        | A      | Scroll picker for duration + start time  | ✅ PASS |                                                                       |
| 60  | Task page toolbar position | A      | Toolbar buttons/components on right side | ✅ PASS | Fixed [#103](https://github.com/IvanTran-2001/FriendChise/issues/103) |

---

## Timetable

| #   | Test                           | As who | What to check                            | Status  | Notes |
| --- | ------------------------------ | ------ | ---------------------------------------- | ------- | ----- |
| 21  | View timetable (daily/weekly)  | A      | Entries show with correct times + colors | ✅ PASS |       |
| 22  | Add task to timetable          | A      | Drag or click to schedule                | ✅ PASS |       |
| 23  | Change task status             | B      | TODO → IN_PROGRESS → DONE                | ✅ PASS |       |
| 24  | Edit entry date                | A      | Change date in popup                     | ✅ PASS |       |
| 25  | Role-based visibility          | B      | Only see tasks matching your role        | ✅ PASS |       |
| 26  | Timetable mobile layout        | Either | Week mode renders correctly              | ✅ PASS |       |
| 27  | Add task on empty timetable    | A      | Can add when no entries exist            | ✅ PASS |       |
| 28  | Role filter                    | A      | Filter timetable by role                 | ✅ PASS |       |
| 57  | Add-task popup layout (mobile) | A      | Popup scrollable, fills screen from top  | ✅ PASS |       |
| 58  | Timetable responsive columns   | Either | Columns reduce as screen narrows (7→3→1) | ✅ PASS |       |

---

## Timetable Templates

| #   | Test                | As who | What to check                       | Status  | Notes |
| --- | ------------------- | ------ | ----------------------------------- | ------- | ----- |
| 29  | Create template     | A      | Weekly template with entries        | ✅ PASS |       |
| 30  | Apply template      | A      | Populates timetable from start date | ✅ PASS |       |
| 31  | Template guard page | B      | Non-permitted user blocked          | ✅ PASS |       |

---

## Members

| #   | Test                           | As who | What to check                              | Status  | Notes |
| --- | ------------------------------ | ------ | ------------------------------------------ | ------- | ----- |
| 32  | Invite member                  | A      | Send invite to Account B                   | ✅ PASS |       |
| 33  | Accept invite                  | B      | Notification → accept → membership created | ✅ PASS |       |
| 34  | Decline invite                 | B      | Status updates, shows in history           | ✅ PASS |       |
| 35  | Invite without role            | A      | Should auto-assign default member          | ✅ PASS |       |
| 36  | Edit member + redirect         | A      | Save → redirect back + toast               | ✅ PASS |       |
| 37  | Delete member                  | A      | Remove from org                            | ✅ PASS |       |
| 38  | Cannot delete owner            | B      | Owner removal blocked                      | ✅ PASS |       |
| 59  | Member detail toolbar position | A      | Action buttons on right side               | ✅ PASS |       |

---

## Franchise

| #   | Test                         | As who | What to check                           | Status  | Notes |
| --- | ---------------------------- | ------ | --------------------------------------- | ------- | ----- |
| 39  | Send franchise token         | A      | Token created, invite sent              | ✅ PASS |       |
| 40  | Join as franchisee           | B      | Org created with cloned roles/tasks     | ✅ PASS |       |
| 41  | Transfer franchise ownership | A      | New owner sees controls                 | ✅ PASS |       |
| 42  | Franchise page guard         | B      | Non-owner blocked, redirect to overview | ✅ PASS |       |

---

## Notifications

| #   | Test                               | As who | What to check                     | Status  | Notes |
| --- | ---------------------------------- | ------ | --------------------------------- | ------- | ----- |
| 43  | Bell shows unseen count            | B      | Red badge appears                 | ✅ PASS |       |
| 44  | Bell clears on click               | B      | Badge clears, marks seen          | ✅ PASS |       |
| 45  | Bell refreshes on click            | B      | Fetches latest notifications      | ✅ PASS |       |
| 46  | Sender notified on accept          | A      | Toast/notification when B accepts | ✅ PASS |       |
| 47  | Notification panel (mobile)        | B      | Panel positioned correctly        | ✅ PASS |       |
| 56  | Notification panel layout (mobile) | B      | Top gap, fills bottom, scrollable | ✅ PASS |       |

---

## Navigation & Layout

| #   | Test                                    | As who | What to check                                             | Status  | Notes                                                                 |
| --- | --------------------------------------- | ------ | --------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| 48  | Sidebar persistence                     | Either | Sidebar stays open between org ↔ settings                 | ✅ PASS |                                                                       |
| 49  | Org switcher                            | A      | Switch orgs, data changes                                 | ✅ PASS |                                                                       |
| 50  | Toolbar buttons position                | A      | Action buttons on right side                              | ✅ PASS |                                                                       |
| 61  | Sidebar auto-close on navigate (mobile) | Either | Sidebar closes when tapping notifications/timetable links | ✅ PASS | Fixed [#104](https://github.com/IvanTran-2001/FriendChise/issues/104) |

---

## State Persistence

| #   | Test                      | As who | What to check                    | Status  | Notes |
| --- | ------------------------- | ------ | -------------------------------- | ------- | ----- |
| 51  | Remember timetable mode   | A      | Daily/weekly persists across nav | ✅ PASS |       |
| 52  | Remember task list mode   | A      | Card/list persists               | ✅ PASS |       |
| 53  | Remember member view mode | A      | Card/list persists               | ✅ PASS |       |
| 54  | Remember template mode    | A      | Calendar/simple persists         | ✅ PASS |       |

---

## Mobile Scroll

| #   | Test                      | As who | What to check                 | Status  | Notes |
| --- | ------------------------- | ------ | ----------------------------- | ------- | ----- |
| 55  | Scroll to bottom (mobile) | Either | Page stays at scroll position | ✅ PASS |       |

---

## Tasks & Members — Layout

| #   | Test                                 | As who | What to check                                   | Status  | Notes                                                                 |
| --- | ------------------------------------ | ------ | ----------------------------------------------- | ------- | --------------------------------------------------------------------- |
| 62  | Detail page max-width                | Either | Fixed max-width container, shrinks responsively | ✅ PASS | Fixed [#105](https://github.com/IvanTran-2001/FriendChise/issues/105) |
| 63  | Edit page responsive layout          | Either | Fixed size on desktop, stacks on mobile         | ✅ PASS | Fixed [#106](https://github.com/IvanTran-2001/FriendChise/issues/106) |
| 64  | Detail page avatar position (mobile) | Either | Photo appears at top of page on mobile          | ✅ PASS | Fixed [#107](https://github.com/IvanTran-2001/FriendChise/issues/107) |

---

## Conclusion

All 64 smoke tests pass across 4 rounds. No outstanding issues remain.

| Round   | Tests | Pass | Partial | Fail | New Issues        |
| ------- | ----- | ---- | ------- | ---- | ----------------- |
| Round 1 | 55    | 21   | 12      | 22   | —                 |
| Round 2 | 55    | 55   | 0       | 0    | 4 new (#97–#100)  |
| Round 3 | 64    | 59   | 0       | 5    | 5 new (#103–#107) |
| Round 4 | 64    | 64   | 0       | 0    | —                 |

**V1 smoke testing complete. ✅ Ready for functional / regression testing.**
