"use client";

/**
 * @file timetable-client/index.tsx
 * Root export for the timetable client module.
 *
 * ## Architecture
 * `TimetableClient` is the root export. It renders one of two views:
 *   - `CalendarView` — a drag-and-drop time-grid (Mon–Sun columns).
 *   - `SimpleView`   — a compact day-grouped table.
 *
 * Both views share `CalendarEditPopup`, a Dialog that lets members update a
 * task's status, and lets MANAGE_TIMETABLE holders also move, reassign, or
 * delete it.
 *
 * ## Permission model
 * - `canManage` (derived from `MANAGE_TIMETABLE` on the server) gates:
 *     - Drag-to-move entries in CalendarView
 *     - The task sidebar (adding new entries)
 *     - The "Actions" dropdown in the toolbar
 *     - Full edit mode in CalendarEditPopup (vs. status-only for regular members)
 * - Any org member can open CalendarEditPopup to update a task's status.
 *
 * ## "Today" highlight
 * Uses `todayStr` (org-timezone YYYY-MM-DD from the server) rather than
 * `isToday()` (browser timezone) to stay consistent with the skip-display
 * logic (`effStatus`) and the date navigation.
 *
 * ## Skip display
 * `effStatus(inst)` returns `"SKIPPED"` for any `TODO` entry whose date is
 * before `todayStr`, giving a visual indication of overdue tasks without
 * mutating the database.
 */

import { useState, useTransition, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays, getDayName, getMonthName } from "../_shared/grid-utils";
import { getMondayOf, formatDayRange } from "./helpers";
import { CalendarView } from "./calendar-view";
import { SimpleView } from "./simple-view";
import type {
  ClientTimetableInstance,
  ClientMembership,
  ClientTask,
} from "./types";

// Re-export types consumed by page.tsx and other server components.
export type { ClientTask, ClientMembership, ClientTimetableInstance };

// ---------------------------------------------------------------------------
// TimetableClient
// ---------------------------------------------------------------------------

interface TimetableClientProps {
  orgId: string;
  instances: ClientTimetableInstance[];
  /** Centre of the 13-day window — the day the server anchored on. */
  anchor: string;
  openTimeMin: number;
  closeTimeMin: number;
  mode: "calendar" | "simple";
  /** "day" forces single-column view; "week" uses automatic ResizeObserver. */
  span?: "day" | "week";
  fillHeight?: boolean;
  todayStr: string;
  roleId?: string | null;
  canManage?: boolean;
  availableTasks?: ClientTask[];
  memberships?: ClientMembership[];
  /** Current user's ID — forwarded to CalendarView for per-user warning suppression. */
  userId?: string;
  /** Toolbar content rendered to the right of the nav (role filter, view picker, actions). */
  children?: ReactNode;
}

export function TimetableClient({
  orgId,
  instances,
  anchor,
  openTimeMin,
  closeTimeMin,
  mode,
  span = "week",
  fillHeight,
  todayStr,
  roleId,
  canManage = false,
  availableTasks,
  memberships,
  userId,
  children,
}: TimetableClientProps) {
  const router = useRouter();
  const [isNavPending, startNavTransition] = useTransition();
  const navigate = (href: string) =>
    startNavTransition(() => router.push(href));

  // Track the actual column count reported by CalendarView (ResizeObserver).
  const [navColCount, setNavColCount] = useState(7);

  // Compute effective column count: SimpleView never updates navColCount,
  // so derive it from mode and span.
  const effectiveColCount =
    mode === "simple" && span === "day"
      ? 1
      : mode === "simple" && span === "week"
        ? 7
        : navColCount;

  const makeHref = (a: string, m: string) => {
    const p = new URLSearchParams({ anchor: a, mode: m, span });
    if (roleId) p.set("roleId", roleId);
    return `/orgs/${orgId}/timetable?${p.toString()}`;
  };

  // Nav depends on the effective column count.
  const half = Math.floor(effectiveColCount / 2);
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  let visStart: string;
  let visEnd: string;
  let isOnToday: boolean;
  let navLabel: string;

  if (effectiveColCount >= 7) {
    // ── Week mode: fixed Mon–Sun window ──────────────────────────────────
    // Always snap to Monday so the visible range is exactly Mon–Sun.
    const weekMon = getMondayOf(anchor);
    visStart = weekMon;
    visEnd = addDays(weekMon, 6);
    prevHref = makeHref(addDays(weekMon, -7), mode);
    nextHref = makeHref(addDays(weekMon, 7), mode);
    todayHref = makeHref(getMondayOf(todayStr), mode);
    isOnToday = todayStr >= visStart && todayStr <= visEnd;
    navLabel = formatDayRange(visStart, visEnd);
  } else {
    // ── Sub-week mode: anchor-centred window ─────────────────────────────
    visStart = addDays(anchor, -half);
    visEnd = addDays(anchor, half);
    prevHref = makeHref(addDays(anchor, -effectiveColCount), mode);
    nextHref = makeHref(addDays(anchor, effectiveColCount), mode);
    todayHref = makeHref(todayStr, mode);
    isOnToday = todayStr >= visStart && todayStr <= visEnd;
    navLabel =
      effectiveColCount === 1
        ? (() => {
            const d = new Date(anchor + "T00:00:00Z");
            return `${getDayName(anchor)}, ${getMonthName(d.getUTCMonth())} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
          })()
        : formatDayRange(visStart, visEnd);
  }

  // Prefetch adjacent pages so navigation feels instant.
  useEffect(() => {
    router.prefetch(prevHref);
    router.prefetch(nextHref);
  }, [prevHref, nextHref, router]);

  return (
    <div className={`flex flex-col${fillHeight ? " flex-1 min-h-0" : ""}`}>
      {/* Combined toolbar */}
      {/* Note: Uses sm:mb-4 (smaller than Toolbar component's sm:mb-6) to reduce
           spacing between the navigation controls and the calendar grid below. */}
      <div className="-mx-4 -mt-4 mb-4 border-b bg-card px-4 min-h-12 py-2 shrink-0 flex flex-wrap items-center gap-2 sm:-mx-6 sm:-mt-6 sm:mb-4 sm:px-6">
        {/* Row 1 (always): prev / date label / next + Today */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate(prevHref)}
              disabled={isNavPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className={`text-sm font-medium text-center px-1 transition-opacity duration-150${isNavPending ? " opacity-50" : ""}`}
            >
              {navLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate(nextHref)}
              disabled={isNavPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs shrink-0 transition-opacity duration-200${isOnToday ? " opacity-0 pointer-events-none" : ""}`}
            onClick={() => navigate(todayHref)}
            disabled={isNavPending || isOnToday}
          >
            Today
          </Button>
        </div>

        {/* Toolbar slot */}
        {children && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
            {children}
          </div>
        )}
      </div>

      <div
        className={`bg-background rounded-xl transition-opacity duration-150${isNavPending ? " opacity-40 pointer-events-none" : ""}${fillHeight ? " flex-1 min-h-0 flex flex-col" : ""}`}
      >
        {mode === "calendar" ? (
          <CalendarView
            instances={instances}
            anchor={anchor}
            span={span}
            openTimeMin={openTimeMin}
            closeTimeMin={closeTimeMin}
            fillHeight={fillHeight}
            orgId={orgId}
            todayStr={todayStr}
            canManage={canManage}
            availableTasks={availableTasks}
            memberships={memberships}
            userId={userId}
            onVisibleRangeChange={(count) => setNavColCount(count)}
          />
        ) : (
          <SimpleView
            instances={instances}
            anchor={anchor}
            span={span}
            todayStr={todayStr}
            canManage={canManage}
            memberships={memberships}
            orgId={orgId}
          />
        )}
      </div>
    </div>
  );
}
