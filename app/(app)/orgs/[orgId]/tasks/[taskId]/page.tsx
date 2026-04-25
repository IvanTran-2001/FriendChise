/**
 * View Task page — `/orgs/[orgId]/tasks/[taskId]`
 *
 * Server component. Any org member can view. Conditionally shows the
 * Actions dropdown (Edit / Delete) only to members with `MANAGE_TASKS`.
 * Includes a back-link toolbar, a detail card with all task fields,
 * and an eligible-roles section.
 * Returns 404 if the task does not belong to the org.
 */
import { notFound } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getTaskById } from "@/lib/services/tasks";
import { Toolbar } from "@/components/layout/toolbar";
import { BackButton } from "@/components/layout/back-button";
import { TaskViewActions } from "./task-view-actions";
import { TaskDescription } from "./task-description";
import { formatDate } from "@/lib/utils";

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface Props {
  params: Promise<{ orgId: string; taskId: string }>;
  searchParams: Promise<{ ref?: string }>;
}

const ViewTaskPage = async ({ params, searchParams }: Props) => {
  const { orgId, taskId } = await params;
  const { ref } = await searchParams;

  const fromTimetable = ref === "timetable";
  const backLabel = fromTimetable ? "← Timetable" : "← Tasks";
  const backHref = fromTimetable
    ? `/orgs/${orgId}/timetable`
    : `/orgs/${orgId}/tasks`;

  const { userId } = await requireOrgMemberPage(orgId);

  const [task, membership] = await Promise.all([
    getTaskById(orgId, taskId),
    getOrgMembership(orgId, userId),
  ]);
  if (!task) notFound();

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TASKS,
      )
    : false;

  const eligibleRoles = task.eligibility.map((e) => e.role);

  return (
    <>
      <Toolbar>
        <BackButton
          fallbackHref={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {backLabel}
        </BackButton>
        {canManage && (
          <TaskViewActions orgId={orgId} taskId={taskId} taskName={task.name} />
        )}
      </Toolbar>

      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{task.name}</h1>

        {/* Detail card */}
        <div className="w-full rounded-lg border bg-card p-6 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-8">
          {/* Left: task fields */}
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                Duration
              </dt>
              <dd className="text-sm">{formatDuration(task.durationMin)}</dd>
            </div>

            {task.preferredStartTimeMin != null && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Preferred start time
                </dt>
                <dd className="text-sm">
                  {formatTime(task.preferredStartTimeMin)}
                </dd>
              </div>
            )}

            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                People required
              </dt>
              <dd className="text-sm">{task.minPeople}</dd>
            </div>

            {(task.minWaitDays != null || task.maxWaitDays != null) && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Wait days
                </dt>
                <dd className="text-sm">
                  {task.minWaitDays != null && task.maxWaitDays != null
                    ? `${task.minWaitDays} – ${task.maxWaitDays} days`
                    : task.minWaitDays != null
                      ? `Min ${task.minWaitDays} days`
                      : `Max ${task.maxWaitDays} days`}
                </dd>
              </div>
            )}

            {task.description && (
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                  Description
                </dt>
                <dd>
                  <TaskDescription description={task.description} />
                </dd>
              </div>
            )}
          </dl>

          {/* Right: photo placeholder + created date */}
          <div className="flex flex-col gap-4 order-first md:order-last">
            <div className="rounded-md bg-muted aspect-square w-full flex items-center justify-center text-xs text-muted-foreground">
              Photo
            </div>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(task.createdAt)}
            </p>
          </div>
        </div>

        {/* Eligible roles */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-sm font-medium mb-3">Eligible roles</h2>
          {eligibleRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">All roles eligible</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {eligibleRoles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: role.color }}
                  />
                  {role.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ViewTaskPage;
