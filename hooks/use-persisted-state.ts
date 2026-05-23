"use client";

import { useState, useEffect, useRef } from "react";

/**
 * useState with automatic localStorage persistence.
 * Falls back to initialValue if localStorage is unavailable or the stored
 * value cannot be parsed (e.g., shape changed after a deploy).
 * Initializes with initialValue on first render to avoid SSR/CSR hydration mismatches,
 * then reads from localStorage after mount.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialize with initialValue to avoid SSR hydration mismatch
  const [state, setState] = useState<T>(initialValue);
  // Tracks whether the initial render has passed — we must NOT write on the
  // first render because the read effect hasn't restored the stored value yet,
  // so writing would overwrite localStorage with the blank initialValue.
  const canWrite = useRef(false);

  // Read from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setState(JSON.parse(raw) as T);
      }
    } catch {
      // Ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once after mount

  // Write to localStorage when state changes (skips the initial render so we
  // don't overwrite the stored value before the read effect has fired)
  useEffect(() => {
    if (!canWrite.current) {
      canWrite.current = true;
      return;
    }
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota exceeded / private browsing errors
    }
  }, [key, state]);

  return [state, setState];
}
