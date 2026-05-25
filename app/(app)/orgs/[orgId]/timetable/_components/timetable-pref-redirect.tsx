"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * TimetablePrefRedirect — syncs timetable view preferences to cookies so the
 * server can restore them on the next bare navigation before any data fetch,
 * eliminating the client-side round-trip flash.
 *
 * Two jobs:
 *  1. On mount: seeds the `timetable-prefs-{orgId}` cookie from the current
 *     URL params. If the URL has no mode/span (bare navigation, server hasn't
 *     redirected yet), falls back to localStorage for one-time migration of
 *     existing users. The server will redirect on the NEXT bare navigation.
 *
 *  2. On URL param changes (mode, span, roleId, tagId): updates the cookie so
 *     the server can restore all prefs — including filters — on re-entry.
 *     `anchor` is intentionally excluded; it is navigation state, not a pref.
 */
export function TimetablePrefRedirect({ orgId }: { orgId: string }) {
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const span = searchParams.get("span");
  const roleId = searchParams.get("roleId");
  const tagId = searchParams.get("tagId");

  function writePrefCookie(value: string) {
    try {
      document.cookie = `timetable-prefs-${orgId}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }

  // On mount: seed the cookie. When mode is in the URL (server already
  // redirected), use the URL values directly. When mode is absent (bare URL,
  // first visit), read localStorage for the one-time migration so the server
  // can redirect correctly on the next visit. anchor is not persisted.
  useEffect(() => {
    let storedMode: string | null = null;
    let storedSpan: string | null = null;
    try {
      storedMode = localStorage.getItem("timetable:mode");
      storedSpan = localStorage.getItem("timetable:span");
    } catch {
      /* ignore */
    }

    const resolvedMode =
      mode === "simple" || mode === "calendar"
        ? mode
        : storedMode === "simple"
          ? "simple"
          : "calendar";
    const resolvedSpan =
      span === "day" || span === "week"
        ? span
        : storedSpan === "day"
          ? "day"
          : "week";

    writePrefCookie(
      JSON.stringify({
        mode: resolvedMode,
        span: resolvedSpan,
        roleId: roleId ?? null,
        tagId: tagId ?? null,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep cookie up-to-date on every URL param change (mode, span, roleId,
  // tagId). Guard on `mode` being present so a bare navigation never
  // overwrites a valid cookie with null values before the server redirects.
  useEffect(() => {
    if (!mode) return;
    writePrefCookie(JSON.stringify({ mode, span, roleId, tagId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, span, roleId, tagId, orgId]);

  return null;
}
