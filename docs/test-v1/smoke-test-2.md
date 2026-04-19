# 🔥 Smoke Test Report V1 - 2

**Date:** —
**Tester:** @IvanTran-2001
**Environment:** Production
**Devices Tested:** Desktop, iPhone, Mobile Browser

---

## Round 2 Summary

| Status | Count |
|--------|-------|
| ✅ Fixed from Round 1 | 29 |
| 🔴 Still broken | 2 |
| 🆕 New issues found | 4 |

---

## ✅ Fixed Since V1 (29)

| V1 # | Issue | GitHub Issue |
|------|-------|--------------|
| 1 | App doesn't remember selected view mode across sessions | [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |
| 2 | Scrolling to bottom glitchily jumps back to top | [#60](https://github.com/IvanTran-2001/FriendChise/issues/60) |
| 3 | No toast shown for unauthorized page access | [#61](https://github.com/IvanTran-2001/FriendChise/issues/61) |
| 4 | Phone input field stretched out on create org / franchise | [#65](https://github.com/IvanTran-2001/FriendChise/issues/65) |
| 5 | Creator should be owner + default member | [#66](https://github.com/IvanTran-2001/FriendChise/issues/66) |
| 6 | Default member should have no permissions | [#67](https://github.com/IvanTran-2001/FriendChise/issues/67) |
| 7 | Stretched timetable layout on week mode (mobile) | [#68](https://github.com/IvanTran-2001/FriendChise/issues/68) |
| 8 | Can't add task on empty timetable screen (mobile) | [#69](https://github.com/IvanTran-2001/FriendChise/issues/69) |
| 9 | No date change control on task edit popup | [#70](https://github.com/IvanTran-2001/FriendChise/issues/70) |
| 10 | No color / visual feedback when changing task status | [#71](https://github.com/IvanTran-2001/FriendChise/issues/71) |
| 11 | Role-based task visibility in timetable | [#72](https://github.com/IvanTran-2001/FriendChise/issues/72) |
| 12 | No dark shade / press feedback on task list (mobile) | [#73](https://github.com/IvanTran-2001/FriendChise/issues/73) |
| 13 | Save after editing task should redirect back | [#74](https://github.com/IvanTran-2001/FriendChise/issues/74) |
| 14 | Toolbar action buttons should be on the right side | [#75](https://github.com/IvanTran-2001/FriendChise/issues/75) |
| 15 | iPhone: tapping task defaults to editing time instead of status | [#76](https://github.com/IvanTran-2001/FriendChise/issues/76) |
| 16 | Add task dialog appears too low / too small on mobile | [#77](https://github.com/IvanTran-2001/FriendChise/issues/77) |
| 17 | Duration / start time should use scrollable time picker | [#78](https://github.com/IvanTran-2001/FriendChise/issues/78) |
| 18 | Settings / Organization page content is not centered | [#79](https://github.com/IvanTran-2001/FriendChise/issues/79) |
| 19 | Notification panel appears too low on mobile | [#80](https://github.com/IvanTran-2001/FriendChise/issues/80) |
| 20 | Bell click should refresh notifications in real time | [#81](https://github.com/IvanTran-2001/FriendChise/issues/81) |
| 21 | Notify sender when their invitation is accepted | [#82](https://github.com/IvanTran-2001/FriendChise/issues/82) |
| 22 | Create Role form inputs blend into the background | [#83](https://github.com/IvanTran-2001/FriendChise/issues/83) |
| 23 | Sidebar closes / doesn't reopen navigating between org and settings | [#84](https://github.com/IvanTran-2001/FriendChise/issues/84) |
| 24 | Member edit save should redirect back and show a toast | [#85](https://github.com/IvanTran-2001/FriendChise/issues/85) |
| 25 | Replace member action dropdown with inline buttons | [#86](https://github.com/IvanTran-2001/FriendChise/issues/86) |
| 26 | Invite without role should assign default | [#87](https://github.com/IvanTran-2001/FriendChise/issues/87) |
| 27 | Transfer requires restart to see franchisee button | [#88](https://github.com/IvanTran-2001/FriendChise/issues/88) |
| 30 | Restrict settings subroutes at layout level (catch-all guard) | [#62](https://github.com/IvanTran-2001/FriendChise/issues/62) |
| 31 | Add route guards for templates + franchise pages | [#63](https://github.com/IvanTran-2001/FriendChise/issues/63), [#64](https://github.com/IvanTran-2001/FriendChise/issues/64) |

---

## 🔴 Still Broken from V1 (2)

| V1 # | Issue | GitHub Issue |
|------|-------|______________|
| 28 | Timetable templates very incomplete — needs to match timetable features | [#93](https://github.com/IvanTran-2001/FriendChise/issues/93) |
| 29 | Warn before applying template to past dates | [#94](https://github.com/IvanTran-2001/FriendChise/issues/94) |

---

## 🆕 New Issues Found (4)

| # | Issue | Type | Device | GitHub Issue |
|---|-------|------|--------|______________|
| 1 | Mobile notification panel should have top gap, touch bottom, be scrollable | Bug | Mobile | [#97](https://github.com/IvanTran-2001/FriendChise/issues/97) |
| 2 | Mobile add-task popup should open from top with gap, touch bottom, be scrollable | Bug | Mobile | [#98](https://github.com/IvanTran-2001/FriendChise/issues/98) |
| 3 | Timetable calendar should reduce visible columns as screen narrows (7 → 3 → 1) | Enhancement | Mobile | [#99](https://github.com/IvanTran-2001/FriendChise/issues/99) |
| 4 | Member detail toolbar actions (Edit, Restrict, Delete) should be on the right | Bug | All | [#100](https://github.com/IvanTran-2001/FriendChise/issues/100) |

---

## Next Steps

1. Fix the 2 remaining V1 issues (#93, #94)
2. Address the 4 new issues (#97–#100)
3. Re-run full test on mobile + desktop
4. Move to functional / regression testing
