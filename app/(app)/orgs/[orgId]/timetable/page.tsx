import { redirect } from "next/navigation";
import { requireOrgMember } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getTaskInstancesForTimetable } from "@/lib/services/task-instances";
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

  const weekStart = weekParam
    ? getMondayDateStr(new Date(weekParam + "T00:00:00Z"))
    : getMondayDateStr(new Date());

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

  return (
    <TimetableClient
      orgId={orgId}
      instances={instances}
      weekStart={weekStart}
      openTimeMin={org?.openTimeMin ?? 360}
      closeTimeMin={org?.closeTimeMin ?? 1320}
      mode={mode}
    />
  );
}
