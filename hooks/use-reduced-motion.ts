"use client";

/**
 * Returns whether the user prefers reduced motion (OS-level accessibility
 * setting). Used to disable scroll-reveal / autoplay animations for visitors
 * who've asked for them to be reduced.
 */
import { useSyncExternalStore } from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let mediaQueryList: MediaQueryList | null = null;

function getMediaQueryList() {
  if (typeof window === "undefined") return null;
  mediaQueryList ??= window.matchMedia(MOTION_QUERY);
  return mediaQueryList;
}

function subscribe(onChange: () => void) {
  const query = getMediaQueryList();
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return getMediaQueryList()?.matches ?? false;
}

function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
