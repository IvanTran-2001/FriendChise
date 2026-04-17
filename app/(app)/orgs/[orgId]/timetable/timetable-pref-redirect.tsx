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
    // Only redirect if neither mode nor span is currently set
    if (searchParams.has("mode") || searchParams.has("span")) return;

    let storedMode: string | null = null;
    let storedSpan: string | null = null;
    try {
      storedMode = localStorage.getItem("timetable:mode");
      storedSpan = localStorage.getItem("timetable:span");
    } catch { /* ignore */ }

    if (!storedMode && !storedSpan) return;

    const params = new URLSearchParams(searchParams.toString());
    if (storedMode === "simple" || storedMode === "calendar") {
      params.set("mode", storedMode);
    }
    if (storedSpan === "day" || storedSpan === "week") {
      params.set("span", storedSpan);
    }
    router.replace(`/orgs/${orgId}/timetable?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
