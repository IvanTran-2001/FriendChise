---
title: Time Model
description: How FriendChise stores timetable time values and converts them for display
order: 10.65
---

FriendChise uses UTC as the storage format for live timetable data, but it displays and accepts those values in the org's configured timezone.

That means the app has three different layers:

- storage uses a normalized UTC timeline
- display uses the org's timezone
- user input is accepted in the org's local context, then converted back to UTC before saving

## Storage

- Live `TimetableEntry` rows store `date` as UTC midnight and `startTimeMin` / `endTimeMin` as UTC minutes from that midnight.
- This keeps the database stable even if the org changes timezone later.
- Template entries are different: they stay in local wall-clock minutes until they are applied.

## Display

- The timetable UI converts stored UTC values back into the org's timezone before rendering.
- The browser's physical location is not the main source of truth for the timetable.
- Some generic client helpers may still use the browser timezone for convenience checks, but persisted timetable data is shown relative to the org's timezone.

## Input

- When a user creates or edits a live timetable entry, the UI treats the time as org-local.
- The server converts that local date and time to UTC with `localToUTC` before saving.
- When an existing entry is shown again, the server converts it back with `utcToLocal`.

## Helpers

- `lib/date-utils.ts` contains the UTC/local conversion helpers.
- The timetable UI uses those helpers at the storage boundary instead of persisting local wall-clock times directly.
- The org's timezone setting is the reference point for timetable conversions.

## Mental model

- Stored data: UTC.
- User display: org timezone.
- User input: local org time, converted back to UTC on save.
