/**
 * @file page.tsx
 * Timetable week-view server component.
 */
import { PermissionAction } from "@prisma/client";
import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getRangeTimetableInstances } from "@/lib/services/timetable-entries";
import { getTimetableTemplates } from "@/lib/services/templates";
import { getOrgTimetableMeta } from "@/lib/services/orgs";
import { getTasks } from "@/lib/services/tasks";
import { getMemberships } from "@/lib/services/memberships";
import { getRoles } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";
import { TimetableClient } from "./timetable-client";
import { TimetableViewPicker } from "./timetable-view-picker";
import { TimetableActions } from "./timetable-actions";
import { RoleFilterButton } from "./role-filter-button";
import { TimetablePrefRedirect } from "./timetable-pref-redirect";
import { toLocalDateStr, addCalendarDays } from "@/lib/date-utils";

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    anchor?: string | string[];
    mode?: string | string[];
    span?: string | string[];
    roleId?: string | string[];
  }>;
}) {
  const { orgId } = await params;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const rawSearchParams = await searchParams;
  const anchorParam = first(rawSearchParams.anchor);
  const modeParam = first(rawSearchParams.mode);
  const spanParam = first(rawSearchParams.span);
  const rawRoleId = first(rawSearchParams.roleId) ?? null;

  const { userId } = await requireOrgMemberPage(orgId);

  const orgMeta = await getOrgTimetableMeta(orgId);
  const orgTz = orgMeta?.timezone ?? "UTC";
  const todayStr = toLocalDateStr(new Date(), orgTz);

  // `anchor` is the centre of the visible window. Default to today.
  // Validate that anchorParam is a semantically valid date.
  let anchor = todayStr;
  if (anchorParam && /^\d{4}-\d{2}-\d{2}$/.test(anchorParam)) {
    const [year, month, day] = anchorParam.split("-").map(Number);
    const utcTime = Date.UTC(year, month - 1, day);
    const d = new Date(utcTime);
    // Round-trip check: ensure the parsed date components match the original
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      anchor = anchorParam;
    }
  }

  // Fetch 13 days centred on anchor (anchor-6 … anchor+6).
  // 9 days (±4) would be enough for sub-week modes (max half=3), but week
  // mode always shows Mon–Sun of the anchor's week. In the worst case the
  // anchor is a Monday, so Sunday (the last visible day) is anchor+6 — just
  // outside a ±4 window. ±6 guarantees the full Mon–Sun is always loaded.
  const rangeStart = addCalendarDays(anchor, -6);

  const mode = modeParam === "simple" ? "simple" : "calendar";
  const span = spanParam === "day" ? "day" : "week";
  const [
    instances,
    templates,
    tasks,
    memberships,
    currentMembership,
    orgRoles,
  ] = await Promise.all([
    getRangeTimetableInstances(orgId, orgTz, rangeStart, 13),
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
    user: m.user ? { id: m.user.id, name: m.user.name } : null,
    botName: m.botName ?? null,
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
  const canViewAll =
    canManageTimetable ||
    (currentMembership
      ? await memberHasPermission(
          currentMembership.id,
          orgId,
          PermissionAction.VIEW_TIMETABLE,
        )
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

  const timetableHref = (m: string, s = span) => {
    const params = new URLSearchParams({ anchor, mode: m, span: s });
    if (rawRoleId) params.set("roleId", rawRoleId);
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 148px)", minHeight: "500px" }}>
      <TimetablePrefRedirect orgId={orgId} />
      <TimetableClient
        orgId={orgId}
        instances={coloredInstances}
        anchor={anchor}
        openTimeMin={orgMeta?.openTimeMin ?? 360}
        closeTimeMin={orgMeta?.closeTimeMin ?? 1320}
        mode={mode}
        span={span}
        fillHeight
        todayStr={todayStr}
        roleId={rawRoleId}
        canManage={canManageTimetable}
        userId={userId}
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
      >
        {/* Role filter */}
        <RoleFilterButton
          roles={filterRoles}
          anchor={anchor}
          mode={mode}
          span={span}
          selectedRoleId={rawRoleId}
          orgId={orgId}
        />
        {/* Calendar/Simple + Day/Week pickers */}
        <TimetableViewPicker
          mode={mode}
          span={span}
          calendarHref={timetableHref("calendar")}
          simpleHref={timetableHref("simple")}
          dayHref={timetableHref(mode, "day")}
          weekHref={timetableHref(mode, "week")}
        />
        {canManageTimetable && (
          <TimetableActions
            orgId={orgId}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              cycleLengthDays: t.cycleLengthDays,
            }))}
            anchor={anchor}
            todayStr={todayStr}
            userId={userId}
          />
        )}
      </TimetableClient>
    </div>
  );
}