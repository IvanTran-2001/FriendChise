"use client";

/**
 * RosterPageClient — owns week-nav and filter state.
 * Renders the Toolbar (nav only) and the board.
 */

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toolbar } from "@/components/layout/toolbar";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { RosterSidebarContent } from "./roster-sidebar-content";
import { RosterClient } from "./roster-client";
import type { RosterEntryRow, DayConfigRow, OrgMember } from "./roster-board";

const WEEKS_SHOWN = 5;

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
  dayConfigs: DayConfigRow[];
  members: OrgMember[];
  roles: Role[];
  templates: RosterTemplate[];
  canManage: boolean;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
  orgTimezone: string;
}

export function RosterPageClient({
  orgId,
  entries,
  dayConfigs,
  members,
  roles,
  templates,
  canManage,
  orgOpenTimeMin,
  orgCloseTimeMin,
  orgTimezone,
}: RosterPageClientProps) {
  const [anchorMonday, setAnchorMonday] = useState<Date>(() =>
    getMondayOfWeek(new Date()),
  );
  const [filterMembershipId, setFilterMembershipId] = useState<string | null>(
    null,
  );

  const weekStarts = useMemo(
    () =>
      Array.from({ length: WEEKS_SHOWN }, (_, i) => addWeeks(anchorMonday, i)),
    [anchorMonday],
  );

  const todayMonday = getMondayOfWeek(new Date()).getTime();
  const todayDayIndex = getTodayDayIndex(orgTimezone);
  const isTodayInView = anchorMonday.getTime() === todayMonday;

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
        entries={entries}
        dayConfigs={dayConfigs}
        members={members}
        weekStarts={weekStarts}
        todayMonday={todayMonday}
        todayDayIndex={todayDayIndex}
        filterMembershipId={filterMembershipId}
        orgOpenTimeMin={orgOpenTimeMin}
        orgCloseTimeMin={orgCloseTimeMin}
      />
    </>
  );
}
