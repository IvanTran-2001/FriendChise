"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Reads timetable mode/span preferences from localStorage and redirects to
 * include them in the URL if the user navigated to the page without explicit
 * params (e.g. clicking the sidebar link).
 *
 * Runs only once on mount — does nothing if mode/span are already in the URL.
 */
export function TimetablePrefRedirect({ orgId }: { orgId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hasMode = searchParams.has("mode");
    const hasSpan = searchParams.has("span");

    let storedMode: string | null = null;
    let storedSpan: string | null = null;
    try {
      storedMode = localStorage.getItem("timetable:mode");
      storedSpan = localStorage.getItem("timetable:span");
    } catch {
      /* ignore */
    }

    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!hasMode && (storedMode === "simple" || storedMode === "calendar")) {
      params.set("mode", storedMode);
      changed = true;
    }

    if (!hasSpan && (storedSpan === "day" || storedSpan === "week")) {
      params.set("span", storedSpan);
      changed = true;
    }

    if (changed) {
      router.replace(`/orgs/${orgId}/timetable?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
