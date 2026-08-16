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

## TODO

- [ ] Provide a standing reviewer/demo account (or a documented process for provisioning one) since dev/demo sign-in is disabled in production builds.
- [ ] Link the published privacy policy URL once available.
- [ ] Fill in App Store / Play Console listing copy (description, screenshots, category) once finalized.
- [ ] Document any age rating / content rating answers once submitted.
