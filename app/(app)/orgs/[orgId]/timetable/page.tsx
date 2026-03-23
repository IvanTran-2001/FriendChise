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
  const noonUTC = Date.UTC(y, m - 1, d, 12, 0, 0);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(noonUTC))
      .map((p) => [p.type, p.value]),
  );
  const lH = parseInt(parts.hour ?? "0") % 24;
  const lM = parseInt(parts.minute ?? "0");
  const lS = parseInt(parts.second ?? "0");
  // offset = how far local time is ahead of UTC at noonUTC
  return noonUTC - ((lH * 3600 + lM * 60 + lS) * 1000 - 12 * 3_600_000);
}

/** Returns the YYYY-MM-DD of Monday of the week containing `dateStr`, computed in `tz`. */
function getMondayDateStr(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
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
 * Projects template instances onto a calendar week.
 *
 * If the template has an `effectiveFrom` date, the cycle is aligned to it so
 * Day 1 always lands on the correct weekday. Otherwise Day 1 = Monday.
 *
 * For cycles shorter than 7 days (e.g. a 3-day cycle) the projection repeats
 * within the week so every day is covered.
 */
function projectTemplateToWeek(
  template: NonNullable<Awaited<ReturnType<typeof getTimetableTemplate>>>,
  weekStart: string,
  orgTz: string,
): ClientTimetableInstance[] {
  // Use org-local midnight so startTimeMin (local minutes) is added to the
  // correct base, and the cycle offset isn't skewed by the UTC offset.
  const weekStartMs = localMidnightUTC(weekStart, orgTz);
  const { templateDays, effectiveFrom, instances } = template;

  // Anchor the cycle to local midnight of the effective date (or fixed Monday).
  // Snapping effectiveFrom to local midnight avoids a skewed cycle offset when
  // the stored timestamp isn't exactly midnight.
  const anchorMs = effectiveFrom
    ? localMidnightUTC(
        getMondayDateStr(toLocalDateStr(effectiveFrom, orgTz), orgTz),
        orgTz,
      )
    : localMidnightUTC("2000-01-03", orgTz);
  const daysSince = Math.floor((weekStartMs - anchorMs) / MS_PER_DAY);
  const cycleStartOffset =
    ((daysSince % templateDays) + templateDays) % templateDays;

  const result: ClientTimetableInstance[] = [];

  for (const inst of instances) {
    if (inst.dayOffset == null || inst.startTimeMin == null) continue;

    // base weekday index for this dayOffset (0 = Monday of this week)
    const baseIndex =
      (((inst.dayOffset - 1 - cycleStartOffset) % templateDays) +
        templateDays) %
      templateDays;

    // repeat if templateDays < 7 (short cycles fill whole week)
    let weekdayIndex = baseIndex;
    while (weekdayIndex < 7) {
      // startTimeMin is minutes from local midnight → base on local midnight of that day
      const dayMs = weekStartMs + weekdayIndex * MS_PER_DAY;
      const startMs = dayMs + inst.startTimeMin * 60 * 1000;
      const endMs = startMs + inst.task.durationMin * 60 * 1000;

      result.push({
        id: `${inst.id}-d${weekdayIndex}`,
        taskId: inst.task.id,
        status: "TODO",
        scheduledStartAt: new Date(startMs).toISOString(),
        scheduledEndAt: new Date(endMs).toISOString(),
        task: {
          id: inst.task.id,
          title: inst.task.title,
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

      weekdayIndex += templateDays;
    }
  }

  return result;
}

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ week?: string; mode?: string; template?: string }>;
}) {
  const { orgId } = await params;
  const {
    week: weekParam,
    mode: modeParam,
    template: templateParam,
  } = await searchParams;

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
  const to = new Date(fromMs + 7 * MS_PER_DAY);

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
    instances = rawInstances.map((inst) => ({
      id: inst.id,
      taskId: inst.taskId,
      status: inst.status,
      scheduledStartAt: inst.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: inst.scheduledEndAt?.toISOString() ?? null,
      task: {
        id: inst.task.id,
        title: inst.task.title,
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
    }));
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
          templates={templates.map((t) => ({ id: t.id, title: t.title }))}
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
