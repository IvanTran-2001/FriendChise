import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOrgMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  getTaskInstancesForTimetable,
  type TimetableInstance,
} from "@/lib/services/task-instances";
import {
  getTimetableTemplates,
  getTimetableTemplate,
} from "@/lib/services/templates";
import { Toolbar } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  TimetableClient,
  type ClientTimetableInstance,
} from "./timetable-client";
import { TemplateSelector } from "./template-selector";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns the YYYY-MM-DD local date string for `d` in the given IANA timezone. */
function toLocalDateStr(d: Date, tz: string): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Returns the UTC ms timestamp for local midnight of `dateStr` (YYYY-MM-DD) in `tz`.
 * Probes at noon UTC to derive the offset robustly across DST transitions.
 */
function localMidnightUTC(dateStr: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let utcMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const desiredAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
    const delta = localAsUtc - desiredAsUtc;
    if (delta === 0) break;
    utcMs -= delta;
  }
  return utcMs;
}

/**
 * Counts the number of calendar days from date string `a` to `b` (b − a).
 * Uses UTC noon arithmetic so the result is independent of DST in any timezone.
 */
function calendarDaysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY,
  );
}

/** Returns the YYYY-MM-DD that is `n` calendar days after `dateStr`. */
function addCalendarDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split("T")[0];
}

/** Returns the YYYY-MM-DD of Monday of the week containing `dateStr`, computed in `tz`. */
function getMondayDateStr(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const probe = new Date(localMidnightUTC(dateStr, tz));
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(probe);
  const DOW_OFFSET: Record<string, number> = {
    Sun: -6,
    Mon: 0,
    Tue: -1,
    Wed: -2,
    Thu: -3,
    Fri: -4,
    Sat: -5,
  };
  const offset = DOW_OFFSET[wd] ?? 0;
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().split("T")[0];
}

/**
 * Projects template entries onto a calendar week.
 * Day 0 is anchored to 2000-01-03 (Monday) so the cycle is consistent.
 * For cycles shorter than 7 days the projection repeats within the week.
 */
function projectTemplateToWeek(
  template: NonNullable<Awaited<ReturnType<typeof getTimetableTemplate>>>,
  weekStart: string,
  orgTz: string,
): ClientTimetableInstance[] {
  const { cycleLengthDays, entries } = template;

  const anchorDateStr = "2000-01-03";
  const daysSince = calendarDaysBetween(anchorDateStr, weekStart);
  const cycleStartOffset =
    ((daysSince % cycleLengthDays) + cycleLengthDays) % cycleLengthDays;

  const result: ClientTimetableInstance[] = [];

  for (const inst of entries) {
    if (inst.startTimeMin == null) continue;

    // base weekday index for this dayIndex (0 = Monday of this week)
    const baseIndex =
      (((inst.dayIndex - cycleStartOffset) % cycleLengthDays) +
        cycleLengthDays) %
      cycleLengthDays;

    // repeat if cycleLengthDays < 7 (short cycles fill whole week)
    let weekdayIndex = baseIndex;
    while (weekdayIndex < 7) {
      const dayMs = localMidnightUTC(
        addCalendarDays(weekStart, weekdayIndex),
        orgTz,
      );
      const startMs = dayMs + inst.startTimeMin * 60 * 1000;
      const endMs = startMs + inst.task.durationMin * 60 * 1000;

      result.push({
        id: `${inst.id}-d${weekdayIndex}`,
        taskId: inst.task.id,
        isProjected: true,
        status: "TODO",
        scheduledStartAt: new Date(startMs).toISOString(),
        scheduledEndAt: new Date(endMs).toISOString(),
        task: {
          id: inst.task.id,
          title: inst.task.name,
          durationMin: inst.task.durationMin,
          preferredStartTimeMin: null,
        },
        assignees: inst.assignees.map((a) => ({
          id: a.id,
          membership: {
            id: a.membership.id,
            user: { id: a.membership.user.id, name: a.membership.user.name },
          },
        })),
      });

      weekdayIndex += cycleLengthDays;
    }
  }

  return result;
}

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    week?: string | string[];
    mode?: string | string[];
    template?: string | string[];
  }>;
}) {
  const { orgId } = await params;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const rawSearchParams = await searchParams;
  const weekParam = first(rawSearchParams.week);
  const modeParam = first(rawSearchParams.mode);
  const templateParam = first(rawSearchParams.template);

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  // Fetch org data first so the week window and projection use org-local time.
  const orgMeta = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true, openTimeMin: true, closeTimeMin: true },
  });
  const orgTz = orgMeta?.timezone ?? "UTC";

  let weekStart: string;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    weekStart = getMondayDateStr(weekParam, orgTz);
  } else {
    weekStart = getMondayDateStr(toLocalDateStr(new Date(), orgTz), orgTz);
  }

  const fromMs = localMidnightUTC(weekStart, orgTz);
  const from = new Date(fromMs);
  // Use localMidnightUTC for the end boundary so a DST change mid-week doesn't
  // shrink or expand the [from, to) window by an hour.
  const to = new Date(localMidnightUTC(addCalendarDays(weekStart, 7), orgTz));

  const mode = modeParam === "simple" ? "simple" : "calendar";
  const selectedTemplateId = templateParam ?? null;

  const [templates, selectedTemplate, rawInstances] = await Promise.all([
    getTimetableTemplates(orgId),
    selectedTemplateId
      ? getTimetableTemplate(orgId, selectedTemplateId)
      : Promise.resolve(null),
    // Only fetch live scheduled instances when no template is selected
    selectedTemplateId
      ? Promise.resolve([] as TimetableInstance[])
      : getTaskInstancesForTimetable(orgId, from, to),
  ]);

  let instances: ClientTimetableInstance[];

  if (selectedTemplate) {
    // Project cycle template onto this week using org-local midnight as the base
    instances = projectTemplateToWeek(selectedTemplate, weekStart, orgTz);
  } else if (selectedTemplateId) {
    // Template param set but not found — show empty
    instances = [];
  } else {
    // No template selected — show live scheduled instances
    instances = rawInstances.map((inst) => {
      const dateStr = inst.date.toISOString().split("T")[0];
      const dayMs = localMidnightUTC(dateStr, orgTz);
      const startMs = dayMs + inst.startTimeMin * 60 * 1000;
      const endMs = dayMs + inst.endTimeMin * 60 * 1000;
      return {
        id: inst.id,
        taskId: inst.taskId,
        status: inst.status as ClientTimetableInstance["status"],
        scheduledStartAt: new Date(startMs).toISOString(),
        scheduledEndAt: new Date(endMs).toISOString(),
        task: {
          id: inst.task.id,
          title: inst.task.name,
          durationMin: inst.task.durationMin,
          preferredStartTimeMin: inst.task.preferredStartTimeMin,
        },
        assignees: inst.assignees.map((a) => ({
          id: a.id,
          membership: {
            id: a.membership.id,
            user: { id: a.membership.user.id, name: a.membership.user.name },
          },
        })),
      };
    });
  }

  const timetableHref = (m: string) =>
    `/orgs/${orgId}/timetable?week=${weekStart}&mode=${m}${selectedTemplateId ? `&template=${selectedTemplateId}` : ""}`;

  return (
    <>
      <Toolbar
        actions={[
          { label: "Templates", href: `/orgs/${orgId}/timetable/templates` },
        ]}
      >
        {/* Template dropdown */}
        <TemplateSelector
          templates={templates.map((t) => ({ id: t.id, title: t.name }))}
          selectedId={selectedTemplateId}
        />

        {/* Filter (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Filter <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Calendar / Simple toggle */}
        <div className="flex rounded-md overflow-hidden border text-sm font-medium">
          <Link
            href={timetableHref("calendar")}
            aria-current={mode === "calendar" ? "page" : undefined}
            className={`px-3 py-1 transition-colors ${
              mode === "calendar"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            Calendar
          </Link>
          <Link
            href={timetableHref("simple")}
            aria-current={mode === "simple" ? "page" : undefined}
            className={`px-3 py-1 border-l transition-colors ${
              mode === "simple"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            Simple
          </Link>
        </div>
      </Toolbar>
      <TimetableClient
        orgId={orgId}
        instances={instances}
        weekStart={weekStart}
        openTimeMin={orgMeta?.openTimeMin ?? 360}
        closeTimeMin={orgMeta?.closeTimeMin ?? 1320}
        mode={mode}
        selectedTemplateId={selectedTemplateId}
      />
    </>
  );
}
