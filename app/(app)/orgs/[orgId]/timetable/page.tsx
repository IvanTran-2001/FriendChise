/**
 * @file page.tsx
 * Timetable week-view server component.
 */
import Link from "next/link";
import { PermissionAction } from "@prisma/client";
import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getWeekTimetableInstances } from "@/lib/services/timetable-entries";
import { getTimetableTemplates } from "@/lib/services/templates";
import { getOrgTimetableMeta } from "@/lib/services/orgs";
import { getTasks } from "@/lib/services/tasks";
import { getMemberships } from "@/lib/services/memberships";
import { getRoles } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { Toolbar } from "@/components/layout/toolbar";
import { TimetableClient } from "./timetable-client";
import { TimetableActions } from "./timetable-actions";
import { RoleFilterButton } from "./role-filter-button";
import { toLocalDateStr, getMondayDateStr } from "@/lib/date-utils";

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    week?: string | string[];
    mode?: string | string[];
    roleId?: string | string[];
  }>;
}) {
  const { orgId } = await params;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const rawSearchParams = await searchParams;
  const weekParam = first(rawSearchParams.week);
  const modeParam = first(rawSearchParams.mode);
  const rawRoleId = first(rawSearchParams.roleId) ?? null;

  const { userId } = await requireOrgMemberPage(orgId);

  const orgMeta = await getOrgTimetableMeta(orgId);
  const orgTz = orgMeta?.timezone ?? "UTC";
  const todayStr = toLocalDateStr(new Date(), orgTz);

  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? getMondayDateStr(weekParam, orgTz)
      : getMondayDateStr(toLocalDateStr(new Date(), orgTz), orgTz);

  const mode = modeParam === "simple" ? "simple" : "calendar";
  const [
    instances,
    templates,
    tasks,
    memberships,
    currentMembership,
    orgRoles,
  ] = await Promise.all([
    getWeekTimetableInstances(orgId, orgTz, weekStart),
    getTimetableTemplates(orgId),
    getTasks(orgId),
    getMemberships(orgId),
    getOrgMembership(orgId, userId),
    getRoles(orgId),
  ]);

  const canManageTimetable = currentMembership
    ? await memberHasPermission(
        currentMembership.id,
        orgId,
        PermissionAction.MANAGE_TIMETABLE,
      )
    : false;

  // Build membership→roles map for client rendering
  const clientMemberships = memberships.map((m) => ({
    id: m.id,
    user: { id: m.user.id, name: m.user.name },
    roles: m.memberRoles.map((mr) => ({
      id: mr.role.id,
      name: mr.role.name,
      color: mr.role.color,
    })),
  }));

  // Roles for filter dropdown — all org roles
  const filterRoles = orgRoles
    .map((r) => ({ id: r.id, name: r.name, color: r.color }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter instances by task eligibility for the selected role
  let filteredInstances = instances;
  if (rawRoleId) {
    const eligibleTaskIds = new Set(
      (
        await prisma.taskEligibility.findMany({
          where: { roleId: rawRoleId, task: { orgId } },
          select: { taskId: true },
        })
      ).map((e) => e.taskId),
    );
    filteredInstances = instances.filter((inst) =>
      eligibleTaskIds.has(inst.taskId),
    );
  }

  const timetableHref = (m: string) => {
    const params = new URLSearchParams({ week: weekStart, mode: m });
    if (rawRoleId) params.set("roleId", rawRoleId);
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 148px)" }}>
      <Toolbar>
        <div className="flex items-center gap-2 flex-1">
          {/* Role filter */}
          <RoleFilterButton
            roles={filterRoles}
            weekStart={weekStart}
            mode={mode}
            selectedRoleId={rawRoleId}
            orgId={orgId}
          />

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
        </div>
        {canManageTimetable && (
          <TimetableActions
            orgId={orgId}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              cycleLengthDays: t.cycleLengthDays,
            }))}
            weekStart={weekStart}
          />
        )}
      </Toolbar>
      <TimetableClient
        orgId={orgId}
        instances={filteredInstances}
        weekStart={weekStart}
        openTimeMin={orgMeta?.openTimeMin ?? 360}
        closeTimeMin={orgMeta?.closeTimeMin ?? 1320}
        mode={mode}
        fillHeight
        todayStr={todayStr}
        roleId={rawRoleId}
        canManage={canManageTimetable}
        availableTasks={canManageTimetable ? tasks : undefined}
        memberships={clientMemberships}
      />
    </div>
  );
}
