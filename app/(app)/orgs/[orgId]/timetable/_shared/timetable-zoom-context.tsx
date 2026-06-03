"use client";

import { useSyncExternalStore, useEffect } from "react";
import { HOUR_HEIGHT } from "./grid-utils";

export const MIN_HOUR_HEIGHT = HOUR_HEIGHT; // 150px — baseline
export const MAX_HOUR_HEIGHT = 400;

// ---------------------------------------------------------------------------
// Timetable zoom store
//
// This module exposes a tiny module-level store for the calendar's hour
// height (zoom). Using a module-level store lets disconnected React
// subtrees (for example the main calendar grid and the sidebar content
// rendered via a Portal/slot) observe and react to the same zoom value
// without prop-drilling.
//
// Important: we intentionally do NOT read `localStorage` at module-load
// time to avoid React hydration mismatches (server-rendered HTML vs client
// initial render). Instead, `TimetableZoomProvider` restores the persisted
// value inside a client-only `useEffect` so the initial render matches the
// SSR output and the persisted value is applied after hydration.
// ---------------------------------------------------------------------------
let _hourHeight = MIN_HOUR_HEIGHT;
const STORAGE_KEY = "timetable:hourHeight";
let _restored = false;
const _listeners = new Set<() => void>();

function notifyAll() {
  for (const l of _listeners) l();
}

const store = {
  subscribe: (cb: () => void) => {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
  },
  getSnapshot: () => _hourHeight,
  setHourHeight: (h: number) => {
    _hourHeight = Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, h));
    notifyAll();
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(_hourHeight));
      }
    } catch {
      // ignore
    }
  },
};

export function useTimetableZoom() {
  const hourHeight = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { hourHeight, setHourHeight: store.setHourHeight };
}

/**
 * TimetableZoomProvider
 *
 * Restores a persisted hour height from `localStorage` after hydration and
 * renders `children`. This restore happens in a `useEffect` to avoid
 * introducing hydration mismatches by reading `localStorage` during SSR or
 * at module load.
 */
export function TimetableZoomProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (_restored) return;
    _restored = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = Number(raw);
        if (!Number.isNaN(v)) {
          // Defer applying the persisted zoom until after hydration completes.
          // Applying it immediately inside the effect can still produce a
          // hydration mismatch warning in development when many inline styles
          // change synchronously. A short timeout avoids the warning while
          // restoring the user's preference shortly after mount.
          const t = setTimeout(() => {
            store.setHourHeight(Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, v)));
          }, 120);
          return () => clearTimeout(t);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return <>{children}</>;
}
