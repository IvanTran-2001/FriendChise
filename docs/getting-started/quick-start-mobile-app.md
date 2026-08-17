---
title: Quick Start for Mobile App
description: Exact setup path for mobile contributors
order: 4
---

## Prerequisites

- Node.js 20 or newer
- pnpm
- Expo Go installed on your phone, or a simulator/emulator if you prefer
- Access to the FriendChise backend URL

## 1. Clone the repo

Fork the repo first, then clone your fork locally.

```bash
git clone https://github.com/IvanTran-2001/friendchise-mobile-app.git
cd friendchise-mobile-app
```

## 2. Install dependencies

```bash
pnpm install
```

## 3. Create `.env`

Create a `.env` file in the repo root with your backend URL.

```env
EXPO_PUBLIC_API_URL=https://friendchise.app
```

If you are running a local backend on a physical mobile device, use your computer's network IP instead of `localhost`. For example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.97:3000
```

## 4. Start the app

```bash
pnpm start
```

Then open the project in the Expo Go app on your phone. If you want to test on a simulator or emulator later, you can use the Expo CLI shortcuts, but Expo Go is the easiest path for the mobile repo.

## 5. If something fails

- Re-check that `EXPO_PUBLIC_API_URL` points to a reachable backend.
- Make sure Expo Go or your simulator is running on the same network as the backend when testing on device.
- Restart the Expo server if the app stops loading or the bundle gets stuck.