"use client";

/**
 * RosterPageClient — owns week-nav and filter state.
 * Renders the Toolbar (nav only) and the board.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/layout/toolbar";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { RosterSidebarContent } from "./roster-sidebar-content";
import { RosterClient } from "./roster-client";
import type { RosterEntryRow, DayConfigRow, OrgMember } from "./roster-board";
import type { SavedRosterEntry } from "@/lib/services/roster";

const WEEKS_SHOWN = 5;
// Prefetch this many extra weeks beyond the visible window when lazy-loading
const PREFETCH_BUFFER = 3;

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d;
}

/** Returns 0=Mon … 6=Sun for today in the given IANA timezone. */
function getTodayDayIndex(tz: string): number {
  const localDate = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  const d = new Date(localDate + "T12:00:00Z"); // noon UTC to avoid DST edge cases
  const jsDay = d.getUTCDay(); // 0=Sun … 6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

type Role = { id: string; name: string; color: string };
type RosterTemplate = { id: string; name: string; cycleWeeks: number };

interface RosterPageClientProps {
  orgId: string;
  entries: RosterEntryRow[];
  prefetchedWeekMs: number[];
  dayConfigs: DayConfigRow[];
  members: OrgMember[];
  roles: Role[];
  templates: RosterTemplate[];
  canManage: boolean;
  currentMembershipId: string | null;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
  orgTimezone: string;
}

export function RosterPageClient({
  orgId,
  entries: initialEntries,
  prefetchedWeekMs,
  dayConfigs,
  members,
  roles,
  templates,
  canManage,
  currentMembershipId,
  orgOpenTimeMin,
  orgCloseTimeMin,
  orgTimezone,
}: RosterPageClientProps) {
  const [anchorMonday, setAnchorMonday] = useState<Date>(() =>
    getMondayOfWeek(new Date()),
  );
  const [filterMembershipId, setFilterMembershipId] = useState<string | null>(
    currentMembershipId,
  );
  const [allEntries, setAllEntries] =
    useState<RosterEntryRow[]>(initialEntries);
  const [loadedWeekMs] = useState<Set<number>>(() => new Set(prefetchedWeekMs));

  const weekStarts = useMemo(
    () =>
      Array.from({ length: WEEKS_SHOWN }, (_, i) => addWeeks(anchorMonday, i)),
    [anchorMonday],
  );

  const todayMonday = getMondayOfWeek(new Date()).getTime();
  const todayDayIndex = getTodayDayIndex(orgTimezone);
  const isTodayInView = anchorMonday.getTime() === todayMonday;

  // Replace the saved cell's entries in local state so the board updates
  // immediately and the panel shows fresh data on next open.
  const handleCellSaved = useCallback(
    (weekStart: Date, dayIndex: number, newEntries: SavedRosterEntry[]) => {
      const wMs = weekStart.getTime();
      setAllEntries((prev) => [
        ...prev.filter(
          (e) => !(e.weekStart.getTime() === wMs && e.dayIndex === dayIndex),
        ),
        // SavedRosterEntry is structurally identical to RosterEntryRow
        ...(newEntries as unknown as RosterEntryRow[]),
      ]);
    },
    [],
  );

  // Returns any weeks in the visible window (plus buffer) that haven't been
  // loaded yet, fetches them, and returns the new entries.
  // Does NOT call setAllEntries — the effect below does that so setState is
  // never called synchronously inside an effect body.
  const fetchMissingWeeks = useCallback(
    async (anchor: Date): Promise<RosterEntryRow[]> => {
      const needed: Date[] = [];
      for (let i = -PREFETCH_BUFFER; i < WEEKS_SHOWN + PREFETCH_BUFFER; i++) {
        const w = addWeeks(anchor, i);
        if (!loadedWeekMs.has(w.getTime())) {
          needed.push(w);
          loadedWeekMs.add(w.getTime()); // mark immediately to avoid duplicate fetches
        }
      }
      if (needed.length === 0) return [];

      const weeksParam = needed.map((d) => d.toISOString()).join(",");
      try {
        const res = await fetch(
          `/api/orgs/${orgId}/roster-entries?weeks=${encodeURIComponent(weeksParam)}`,
        );
        if (!res.ok) return [];
        // API returns dates as ISO strings — rehydrate weekStart to Date
        const raw: (Omit<RosterEntryRow, "weekStart"> & {
          weekStart: string;
        })[] = await res.json();
        return raw.map((e) => ({ ...e, weekStart: new Date(e.weekStart) }));
      } catch {
        return [];
      }
    },
    [orgId, loadedWeekMs],
  );

  useEffect(() => {
    let active = true;
    fetchMissingWeeks(anchorMonday).then((fetched) => {
      if (active && fetched.length > 0) {
        setAllEntries((prev) => [...prev, ...fetched]);
      }
    });
    return () => {
      active = false;
    };
  }, [anchorMonday, fetchMissingWeeks]);

  return (
    <>
      <RegisterPageSidebar
        content={
          <RosterSidebarContent
            orgId={orgId}
            roles={roles}
            templates={templates}
            canManage={canManage}
            members={members}
            filterMembershipId={filterMembershipId}
            onFilterChange={setFilterMembershipId}
          />
        }
      />

      <Toolbar>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchorMonday((d) => addWeeks(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isTodayInView}
          onClick={() => setAnchorMonday(getMondayOfWeek(new Date()))}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchorMonday((d) => addWeeks(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Toolbar>

      <RosterClient
        orgId={orgId}
        entries={allEntries}
        dayConfigs={dayConfigs}
        members={members}
        weekStarts={weekStarts}
        todayMonday={todayMonday}
        todayDayIndex={todayDayIndex}
        filterMembershipId={filterMembershipId}
        orgOpenTimeMin={orgOpenTimeMin}
        orgCloseTimeMin={orgCloseTimeMin}
        onCellSaved={handleCellSaved}
      />
    </>
  );
}
