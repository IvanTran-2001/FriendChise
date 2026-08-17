---
title: Base URL and Environments
description: Production and local development API base URLs, and how to configure them for the mobile app
order: 1
---

## Production

The production API is served from the same origin as the web app.

```text
https://friendchise.app
```

All `/api/*` routes are relative to this base. For example:

```http
GET https://friendchise.app/api/mobile/me
```

The mobile app reads the base URL from the `EXPO_PUBLIC_API_URL` environment variable:

```bash
EXPO_PUBLIC_API_URL=https://friendchise.app
```

This should be set in the production mobile build configuration so production builds talk to the live web backend.

## Local development

### Why `localhost` doesn't work on a physical device

When the mobile app runs on a physical phone, `localhost` refers to the phone itself, not your computer. You must use your computer's local network IP address instead.

Plain HTTP is only appropriate for trusted local development networks. Outside local development, use HTTPS or a secure tunnel.

Find the network address in the terminal output when you start the backend:

```bash
Network: http://192.168.1.97:3000
```

Set `EXPO_PUBLIC_API_URL` to that address in your local `.env`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.97:3000
```

Your IP may be different on each machine and can change when you switch networks. Re-check it whenever you switch networks or restart your router.

### Simulators

iOS Simulator uses `localhost`. Android Emulator uses `10.0.2.2`, which resolves to the host machine from inside the emulator.

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

## Environments summary

| Environment | Base URL | Notes |
| --- | --- | --- |
| Production | `https://friendchise.app` | Live data, real OAuth |
| Local (device) | `http://<your-machine-ip>:3000` | Must match backend network address |
| Local (iOS simulator) | `http://localhost:3000` | iOS Simulator only |
| Local (Android emulator) | `http://10.0.2.2:3000` | Android Emulator only |
