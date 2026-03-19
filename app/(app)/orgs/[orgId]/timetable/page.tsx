import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOrgMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getTaskInstancesForTimetable } from "@/lib/services/task-instances";
import { Toolbar } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  TimetableClient,
  type ClientTimetableInstance,
} from "./timetable-client";

/** Returns the YYYY-MM-DD string for the Monday of the week containing `date` (UTC). */
function getMondayDateStr(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split("T")[0];
}

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ week?: string; mode?: string }>;
}) {
  const { orgId } = await params;
  const { week: weekParam, mode: modeParam } = await searchParams;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) redirect("/");

  let weekStart: string;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const parsed = new Date(weekParam + "T00:00:00Z");
    weekStart = Number.isNaN(parsed.getTime())
      ? getMondayDateStr(new Date())
      : getMondayDateStr(parsed);
  } else {
    weekStart = getMondayDateStr(new Date());
  }

  const from = new Date(weekStart + "T00:00:00Z");
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  const [org, rawInstances] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { openTimeMin: true, closeTimeMin: true },
    }),
    getTaskInstancesForTimetable(orgId, from, to),
  ]);

  const mode = modeParam === "simple" ? "simple" : "calendar";

  // Explicitly serialize all Date fields so the client component boundary
  // receives plain strings instead of Prisma Date objects.
  const instances: ClientTimetableInstance[] = rawInstances.map((inst) => ({
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
        user: {
          id: a.membership.user.id,
          name: a.membership.user.name,
        },
      },
    })),
  }));

  const timetableHref = (m: string) =>
    `/orgs/${orgId}/timetable?week=${weekStart}&mode=${m}`;

  return (
    <>
      <Toolbar actions={[{ label: "Templates", href: `/orgs/${orgId}/timetable/templates` }]}>
        {/* Week-view type (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Week <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Filter (placeholder) */}
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          Filter <ChevronDown className="h-3.5 w-3.5" />
        </Button>

        {/* Calendar / Simple toggle */}
        <div className="flex rounded-md overflow-hidden border text-sm font-medium">
          <Link
            href={timetableHref("calendar")}
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
        openTimeMin={org?.openTimeMin ?? 360}
        closeTimeMin={org?.closeTimeMin ?? 1320}
        mode={mode}
      />
    </>
  );
}
