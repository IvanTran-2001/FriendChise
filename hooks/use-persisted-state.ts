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
  options?: { broadcast?: boolean },
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // Initialize with initialValue to avoid SSR hydration mismatch
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const lastSerializedRef = useRef<string | null>(null);

  // Read from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const eventName = `persisted-state-change:${key}`;

    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          lastSerializedRef.current = raw;
          setState(JSON.parse(raw) as T);
        }
      } catch {
        // Ignore parse errors
      }
    };

    const onCustomChange = () => syncFromStorage();

    const onStorageChange = (event: StorageEvent) => {
      if (event.key === key) syncFromStorage();
    };

    window.addEventListener(eventName, onCustomChange as EventListener);
    window.addEventListener("storage", onStorageChange as EventListener);
    try {
      syncFromStorage();
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
    return () => {
      window.removeEventListener(eventName, onCustomChange as EventListener);
      window.removeEventListener("storage", onStorageChange as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once after mount

  // Write to localStorage when state changes (only after hydration is complete)
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    const serialized = JSON.stringify(state);
    if (lastSerializedRef.current === serialized) return;
    try {
      localStorage.setItem(key, serialized);
      lastSerializedRef.current = serialized;
      if (options?.broadcast !== false) {
        window.dispatchEvent(new CustomEvent(`persisted-state-change:${key}`));
      }
    } catch {
      // Ignore quota exceeded / private browsing errors
    }
  }, [key, options?.broadcast, state, hydrated]);

  return [state, setState, hydrated];
}
