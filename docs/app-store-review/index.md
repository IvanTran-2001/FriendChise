---
title: App Store Review Notes
description: Notes for App Store / Play Store reviewers and for whoever submits a build
order: 10
---

This page collects the information a reviewer (or a teammate preparing a submission) needs about the `friendchise-mobile-app` client.

## What the app does

FriendChise Mobile is a companion client to the FriendChise web app (see [Mobile App](/doc/mobile-app)). It lets signed-in members of a franchise organization view and manage tasks, scheduling, and related tools from a phone.

## Signing in for review

- The production build authenticates against the live backend (`https://friendchise.app`) using the same OAuth providers as the web app (Google, LinkedIn).
- Development-only credential flows (seeded dev users, one-tap demo sessions) are disabled in production builds and are **not** available to reviewers testing a production build.

## Requested permissions

| Permission | Why it's requested |
| --- | --- |
| Camera (`NSCameraUsageDescription`) | Taking photos to attach to task images |
| Photo Library (`NSPhotoLibraryUsageDescription`) | Picking an existing photo for a task image |
| Photo Library Add (`NSPhotoLibraryAddUsageDescription`) | Saving a task image back to the device's photo library |

No other sensitive device permissions (location, contacts, microphone, etc.) are requested.

## Data and privacy

- The app does not use non-exempt encryption beyond standard HTTPS/TLS (`ITSAppUsesNonExemptEncryption: false` in `app.json`).

## Submission checklist

- [ ] Reviewer access: provide a reviewer/demo account or document the exact provisioning steps for production review. Production builds use the live OAuth flow and do not expose dev/demo sign-in.
- [x] Privacy policy URL: https://friendchise.app/privacy
- [ ] App Store / Play Console listing copy: finalize the description, screenshots, category, and review notes before release.
- [ ] Age / content rating: record the final App Store and Play Console questionnaire answers before release.
