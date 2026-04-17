"use client";

import { useState, useEffect } from "react";

/**
 * useState with automatic localStorage persistence.
 * Falls back to initialValue if localStorage is unavailable or the stored
 * value cannot be parsed (e.g., shape changed after a deploy).
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota exceeded / private browsing errors
    }
  }, [key, state]);

  return [state, setState];
}
