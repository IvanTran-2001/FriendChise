---
title: Smoke Test
description: A quick manual verification checklist after setup
order: 100
---
Follow these steps one by one after you finish setup:

1. Start the app with `pnpm dev`.
2. Open the app in your browser.
3. Go to the sign-in page.
4. Sign in using a seeded dev user.
5. Confirm you land on the main app without errors.
6. Open the org switcher and confirm organizations load.
7. Open a task page and confirm task details render.
8. Check the timetable and confirm data loads.
9. Open the admin area if your account has access.
10. Confirm the page refresh still keeps your session intact.

## What to look for

- No console errors
- No broken navigation
- No failed data loads
- No authentication loops

## If something fails

- Re-check `.env.local`
- Re-run `pnpm seed`
- Re-run `pnpm prisma migrate deploy`
- Confirm your seed namespace matches the contributor setup
