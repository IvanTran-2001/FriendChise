/**
 * View Task page — `/orgs/[orgId]/tasks/[taskId]`
 *
 * Server component. Any org member can view tasks their org owns or has
 * inherited via TaskInheritance. Returns 404 if neither applies.
 *
 * The page sidebar (TaskDetailSidebar) conditionally renders:
 *  - "Inherited from franchisor" notice — franchisee orgs viewing a parent task
 *  - Sharing controls (publish / make private) — task-owning org with MANAGE_TASKS
 *  - Actions (Edit link, Delete) — task-owning org with MANAGE_TASKS
 *
 * The layout editor is disabled for now because the feature is not ready.
 */
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PermissionAction } from "@prisma/client";
import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getAccessibleTaskById } from "@/lib/services/tasks";
import { createSignedReadUrl } from "@/lib/supabase-storage";
import { RegisterPageSidebarSubContent } from "@/components/layout/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { BackButton } from "@/components/layout/back-button";
import { Clock, Users, AlarmClock, RefreshCw, Globe, Lock } from "lucide-react";
import { TaskDescription } from "./task-description";
import { TaskDetailSidebar } from "./task-detail-sidebar";
import { TaskComments } from "./comments/index";
import { formatDate } from "@/lib/utils";
import type { TaskToolSelection } from "../_components/task-tools-picker";

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

  const [accessible, membership] = await Promise.all([
    getAccessibleTaskById(orgId, taskId),
    getOrgMembership(orgId, userId),
  ]);
  if (!accessible) notFound();

  const { task, isOwner } = accessible;

  const [canManage, imageSignedUrl] = await Promise.all([
    membership
      ? memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_TASKS)
      : Promise.resolve(false),
    task.imageUrl ? createSignedReadUrl(task.imageUrl) : Promise.resolve(null),
  ]);

  const sharedBy = !isOwner
    ? (task?.organization?.name ?? undefined)
    : undefined;
  const createdByName = task?.createdByName ?? undefined;

  const eligibleRoles = task.eligibility.map((e) => e.role);
  const taskTags = task.tags.map((t) => t.tag);
  const taskTools: TaskToolSelection[] = task.taskToolLinks.map((tool) => ({
    toolPath: tool.toolPath,
    toolLabel: tool.toolLabel ?? "Tool",
  }));
  return (
    <>
      <RegisterPageSidebarSubContent
        content={
          <TaskDetailSidebar
            orgId={orgId}
            taskId={taskId}
            taskName={task.name}
            isOwner={isOwner}
            canManage={canManage}
            scope={task.scope as "ORG" | "GLOBAL"}
            sharedBy={sharedBy}
            createdByName={createdByName}
            taskTools={taskTools}
          />
        }
      />
      <RegisterPageToolbar>
        <BackButton
          fallbackHref={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {backLabel}
        </BackButton>
      </RegisterPageToolbar>

      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        {/* Page header */}
        <div className="flex items-start gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0 mt-2"
            style={{ backgroundColor: task.color }}
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">
              {task.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-1.5 mt-1">
              {createdByName && (
                <span className="text-sm text-muted-foreground">
                  By {createdByName}
                </span>
              )}
              {createdByName && (
                <span className="text-muted-foreground/40 select-none">·</span>
              )}
              <span className="text-sm text-muted-foreground">
                {formatDate(task.createdAt)}
              </span>
              {sharedBy && (
                <>
                  <span className="text-muted-foreground/40 select-none">·</span>
                  <span className="text-sm text-muted-foreground">
                    Shared from {sharedBy}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main unified card */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Color accent bar */}
          <div className="h-1.5" style={{ backgroundColor: task.color }} />

          {/* Image + structured fields */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
            {/* Left: cover image or colored initial block */}
            <div>
              {imageSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSignedUrl}
                  alt={`Photo for ${task.name}`}
                  className="rounded-md aspect-square w-full object-cover"
                />
              ) : (
                <div
                  className="rounded-md aspect-square w-full flex items-center justify-center text-3xl font-bold select-none"
                  style={{
                    backgroundColor: task.color + "20",
                    color: task.color,
                  }}
                >
                  {task.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Right: key fields */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Duration */}
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">
                      {formatDuration(task.durationMin)}
                    </p>
                  </div>
                </div>

                {/* People */}
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">People</p>
                    <p className="text-sm font-medium">{task.minPeople}</p>
                  </div>
                </div>

                {/* Start time */}
                {task.preferredStartTimeMin != null && (
                  <div className="flex items-start gap-2">
                    <AlarmClock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Start time</p>
                      <p className="text-sm font-medium">
                        {formatTime(task.preferredStartTimeMin)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Wait days */}
                {(task.minWaitDays != null || task.maxWaitDays != null) && (
                  <div className="flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Wait days</p>
                      <p className="text-sm font-medium">
                        {task.minWaitDays != null && task.maxWaitDays != null
                          ? `${task.minWaitDays}–${task.maxWaitDays} days`
                          : task.minWaitDays != null
                            ? `Min ${task.minWaitDays} days`
                            : `Max ${task.maxWaitDays} days`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scope badge */}
              <div className="mt-auto">
                {task.scope === "GLOBAL" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950 rounded-full px-2.5 py-1 border border-emerald-200 dark:border-emerald-800">
                    <Globe className="w-3 h-3" />
                    Shared with franchise
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1 border border-border">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="border-t border-border px-6 py-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Description
              </h2>
              <TaskDescription description={task.description} orgId={orgId} />
            </div>
          )}

          {/* Tags + Eligible roles */}
          <div className="border-t border-border px-6 py-5 flex flex-col gap-5">
            {taskTags.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Tags
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {taskTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Eligible roles
              </h2>
              {eligibleRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All roles eligible
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {eligibleRoles.map((role) => (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
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
        </div>

        {/* Comments */}
        <Suspense
          fallback={
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Loading comments...
              </div>
            </div>
          }
        >
          <TaskComments orgId={orgId} taskId={taskId} />
        </Suspense>
      </div>
    </>
  );
};

export default ViewTaskPage;
