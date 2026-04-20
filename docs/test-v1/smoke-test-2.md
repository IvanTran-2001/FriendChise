# 🔥 Smoke Test Report V1 - 2

**Date:** 2026-04-19
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

### 🌐 General / All Pages

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 1 | App doesn't remember selected view mode across sessions | Enhancement | All | [#59](https://github.com/IvanTran-2001/FriendChise/issues/59) |
| 2 | Scrolling to bottom glitchily jumps back to top | Bug | All | [#60](https://github.com/IvanTran-2001/FriendChise/issues/60) |
| 3 | No toast shown for unauthorized page access | Enhancement | All | [#61](https://github.com/IvanTran-2001/FriendChise/issues/61) |
| 30 | Restrict settings subroutes at layout level (catch-all guard) | Enhancement | All | [#62](https://github.com/IvanTran-2001/FriendChise/issues/62) |
| 31 | Add route guards for templates + franchise pages | Bug | All | [#63](https://github.com/IvanTran-2001/FriendChise/issues/63), [#64](https://github.com/IvanTran-2001/FriendChise/issues/64) |

### 🏢 Franchise / Org Creation

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 4 | Phone input field stretched out on create org / franchise | Bug | Mobile | [#65](https://github.com/IvanTran-2001/FriendChise/issues/65) |
| 5 | Creator should be owner + default member | Enhancement | All | [#66](https://github.com/IvanTran-2001/FriendChise/issues/66) |
| 6 | Default member should have no permissions | Enhancement | All | [#67](https://github.com/IvanTran-2001/FriendChise/issues/67) |

### 📅 Timetable

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 7 | Stretched timetable layout on week mode | Bug | Mobile | [#68](https://github.com/IvanTran-2001/FriendChise/issues/68) |
| 8 | Can't add task on empty timetable screen | Bug | Mobile | [#69](https://github.com/IvanTran-2001/FriendChise/issues/69) |
| 9 | No date change control on task edit popup | Bug | All | [#70](https://github.com/IvanTran-2001/FriendChise/issues/70) |
| 10 | No color / visual feedback when changing task status | Enhancement | All | [#71](https://github.com/IvanTran-2001/FriendChise/issues/71) |
| 11 | Role-based task visibility in timetable | Enhancement | All | [#72](https://github.com/IvanTran-2001/FriendChise/issues/72) |

### ✅ Tasks

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 12 | No dark shade / press feedback on task list | Bug | Mobile | [#73](https://github.com/IvanTran-2001/FriendChise/issues/73) |
| 13 | Save after editing task should redirect back | Enhancement | All | [#74](https://github.com/IvanTran-2001/FriendChise/issues/74) |
| 14 | Toolbar action buttons should be on the right side | Enhancement | All | [#75](https://github.com/IvanTran-2001/FriendChise/issues/75) |
| 15 | iPhone: tapping task defaults to editing time instead of status | Bug | iPhone | [#76](https://github.com/IvanTran-2001/FriendChise/issues/76) |
| 16 | Add task dialog appears too low / too small on mobile | Bug | Mobile | [#77](https://github.com/IvanTran-2001/FriendChise/issues/77) |
| 17 | Duration / start time should use scrollable time picker | Enhancement | All | [#78](https://github.com/IvanTran-2001/FriendChise/issues/78) |

### ⚙️ Settings / Organization

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 18 | Settings / Organization page content is not centered | Bug | All | [#79](https://github.com/IvanTran-2001/FriendChise/issues/79) |

### 🔔 Notifications

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 19 | Notification panel appears too low on mobile | Bug | Mobile | [#80](https://github.com/IvanTran-2001/FriendChise/issues/80) |
| 20 | Bell click should refresh notifications in real time | Enhancement | All | [#81](https://github.com/IvanTran-2001/FriendChise/issues/81) |
| 21 | Notify sender when their invitation is accepted | Enhancement | All | [#82](https://github.com/IvanTran-2001/FriendChise/issues/82) |

### 🎨 Roles

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 22 | Create Role form inputs blend into the background | Bug | All | [#83](https://github.com/IvanTran-2001/FriendChise/issues/83) |

### 📱 NavBar / Sidebar

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 23 | Sidebar closes / doesn't reopen navigating between org and settings | Bug | Mobile | [#84](https://github.com/IvanTran-2001/FriendChise/issues/84) |

### 👥 Members

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 24 | Member edit save should redirect back and show a toast | Enhancement | All | [#85](https://github.com/IvanTran-2001/FriendChise/issues/85) |
| 25 | Replace member action dropdown with inline buttons | Enhancement | All | [#86](https://github.com/IvanTran-2001/FriendChise/issues/86) |
| 26 | Invite without role should assign default | Enhancement | All | [#87](https://github.com/IvanTran-2001/FriendChise/issues/87) |

### 🏪 Franchise

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 27 | Transfer requires restart to see franchisee button | Bug | All | [#88](https://github.com/IvanTran-2001/FriendChise/issues/88) |

---

## 🔴 Still Broken from V1 (2)

### 📋 Timetable Templates

| V1 # | Issue | Type | Device | GitHub Issue |
|------|-------|------|--------|--------------|
| 28 | Timetable templates very incomplete — needs to match timetable features | Enhancement | All | [#93](https://github.com/IvanTran-2001/FriendChise/issues/93) |
| 29 | Warn before applying template to past dates | Enhancement | All | [#94](https://github.com/IvanTran-2001/FriendChise/issues/94) |

---

## 🆕 New Issues Found (4)

### 🔔 Notifications

| # | Issue | Type | Device | GitHub Issue |
|---|-------|------|--------|--------------|
| 1 | Mobile notification panel should have top gap, touch bottom, be scrollable | Bug | Mobile | [#97](https://github.com/IvanTran-2001/FriendChise/issues/97) |

### 📅 Timetable

| # | Issue | Type | Device | GitHub Issue |
|---|-------|------|--------|--------------|
| 2 | Mobile add-task popup should open from top with gap, touch bottom, be scrollable | Bug | Mobile | [#98](https://github.com/IvanTran-2001/FriendChise/issues/98) |
| 3 | Timetable calendar should reduce visible columns as screen narrows (7 → 3 → 1) | Enhancement | Mobile | [#99](https://github.com/IvanTran-2001/FriendChise/issues/99) |

### 👥 Members

| # | Issue | Type | Device | GitHub Issue |
|---|-------|------|--------|--------------|
| 4 | Member detail toolbar actions (Edit, Restrict, Delete) should be on the right | Bug | All | [#100](https://github.com/IvanTran-2001/FriendChise/issues/100) |

---

## Next Steps

1. Fix the 2 remaining V1 issues (#93, #94)
2. Address the 4 new issues (#97–#100)
3. Re-run full test on mobile + desktop
4. Move to functional / regression testing