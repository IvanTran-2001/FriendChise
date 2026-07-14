"use client";

import { useRouter } from "next/navigation";

/**
 * Shared back-navigation helper used by toolbar and sidebar back controls.
 * Falls back to the provided route when browser history has no usable entry.
 */
export function useBackNavigation(fallbackHref: string) {
  const router = useRouter();

  return () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };
}