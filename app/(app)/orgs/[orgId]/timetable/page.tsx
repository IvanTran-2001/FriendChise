/**
 * @file page.tsx
 * Timetable week-view server component.
 */
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
import { TimetableViewPicker } from "./timetable-view-picker";
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
    span?: string | string[];
    day?: string | string[];
  }>;
}) {
  const { orgId } = await params;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const rawSearchParams = await searchParams;
  const weekParam = first(rawSearchParams.week);
  const modeParam = first(rawSearchParams.mode);
  const rawRoleId = first(rawSearchParams.roleId) ?? null;
  const spanParam = first(rawSearchParams.span);
  const dayParam = first(rawSearchParams.day);

  const { userId } = await requireOrgMemberPage(orgId);

  const orgMeta = await getOrgTimetableMeta(orgId);
  const orgTz = orgMeta?.timezone ?? "UTC";
  const todayStr = toLocalDateStr(new Date(), orgTz);

  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? getMondayDateStr(weekParam, orgTz)
      : getMondayDateStr(toLocalDateStr(new Date(), orgTz), orgTz);

  const mode = modeParam === "simple" ? "simple" : "calendar";
  const span = spanParam === "day" ? "day" : "week";
  const dayStr =
    dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)
      ? dayParam
      : span === "day" && weekStart
        ? weekStart
        : todayStr;
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

  // Role-based visibility (#72): if the member does not hold MANAGE_TIMETABLE
  // or VIEW_TIMETABLE, only show tasks that are either unassigned to any role
  // or assigned to at least one of the member's roles.
  const canViewAll = canManageTimetable || (currentMembership
    ? await memberHasPermission(currentMembership.id, orgId, PermissionAction.VIEW_TIMETABLE)
    : false);

  if (!canViewAll && currentMembership) {
    // Gather all role IDs that the current member holds.
    const memberRoleRows = await prisma.memberRole.findMany({
      where: { membershipId: currentMembership.id },
      select: { roleId: true },
    });
    const memberRoleIds = new Set(memberRoleRows.map((r) => r.roleId));

    // Tasks with NO eligibility rows are visible to everyone.
    // Tasks WITH eligibility rows are only visible if the member has ≥1 matching role.
    const eligibilities = await prisma.taskEligibility.findMany({
      where: { task: { orgId } },
      select: { taskId: true, roleId: true },
    });
    const taskEligMap = new Map<string, Set<string>>();
    for (const e of eligibilities) {
      if (!taskEligMap.has(e.taskId)) taskEligMap.set(e.taskId, new Set());
      taskEligMap.get(e.taskId)!.add(e.roleId);
    }

    filteredInstances = filteredInstances.filter((inst) => {
      const roles = taskEligMap.get(inst.taskId);
      if (!roles || roles.size === 0) return true; // open task — visible to all
      for (const roleId of roles) {
        if (memberRoleIds.has(roleId)) return true;
      }
      return false;
    });
  }

  // Map taskId → role color (use filtered role when active, else first eligible)
  const taskRoleColorMap = new Map(
    tasks.map((t) => {
      if (rawRoleId) {
        const filteredRole = t.eligibility.find((e) => e.role.id === rawRoleId);
        return [t.id, filteredRole?.role?.color ?? null];
      }
      return [t.id, t.eligibility[0]?.role?.color ?? null];
    }),
  );
  const coloredInstances = filteredInstances.map((inst) => ({
    ...inst,
    taskColor: taskRoleColorMap.get(inst.taskId) ?? null,
  }));

  const timetableHref = (m: string, s = span, d = dayStr) => {
    const params = new URLSearchParams({
      week: weekStart,
      mode: m,
      span: s,
      day: d,
    });
    if (rawRoleId) params.set("roleId", rawRoleId);
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 148px)" }}>
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Role filter */}
          <RoleFilterButton
            roles={filterRoles}
            weekStart={weekStart}
            mode={mode}
            selectedRoleId={rawRoleId}
            orgId={orgId}
          />

          {/* Day/Week + Calendar/Simple pickers */}
          <TimetableViewPicker
            mode={mode}
            span={span}
            calendarHref={timetableHref("calendar")}
            simpleHref={timetableHref("simple")}
            dayHref={timetableHref(mode, "day", weekStart)}
            weekHref={timetableHref(mode, "week", weekStart)}
          />
        </div>
        {canManageTimetable && (
          <div className="flex items-center gap-2 flex-wrap">
            <TimetableActions
              orgId={orgId}
              templates={templates.map((t) => ({
                id: t.id,
                name: t.name,
                cycleLengthDays: t.cycleLengthDays,
              }))}
              weekStart={weekStart}
            />
          </div>
        )}
      </Toolbar>
      <TimetableClient
        orgId={orgId}
        instances={coloredInstances}
        weekStart={weekStart}
        openTimeMin={orgMeta?.openTimeMin ?? 360}
        closeTimeMin={orgMeta?.closeTimeMin ?? 1320}
        mode={mode}
        span={span}
        dayStr={dayStr}
        fillHeight
        todayStr={todayStr}
        roleId={rawRoleId}
        canManage={canManageTimetable}
        availableTasks={
          canManageTimetable
            ? tasks.map((t) => {
                const displayRole = rawRoleId
                  ? t.eligibility.find((e) => e.role.id === rawRoleId)?.role
                  : t.eligibility[0]?.role;
                return {
                  id: t.id,
                  name: t.name,
                  durationMin: t.durationMin,
                  color: t.color,
                  roleColor: displayRole?.color ?? null,
                  roleName: displayRole?.name ?? null,
                };
              })
            : undefined
        }
        memberships={clientMemberships}
      />
    </div>
  );
}
