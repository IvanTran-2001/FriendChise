/**
 * @file page.tsx
 * Timetable week-view server component.
 */
import { PermissionAction } from "@prisma/client";
import { cookies } from "next/headers";

import { requireOrgMemberPage } from "@/lib/authz";
import { getOrgMembership, memberHasPermission } from "@/lib/authz/_shared";
import { getRangeTimetableInstances } from "@/lib/services/timetable-entries";
import { getTimetableTemplates } from "@/lib/services/templates";
import { getOrgTimetableMeta } from "@/lib/services/orgs";
import { getInheritedTasks } from "@/lib/services/tasks";
import { getMemberships } from "@/lib/services/memberships";
import { getRoles } from "@/lib/services/roles";
import { getOrgTags } from "@/lib/services/tags";
import { prisma } from "@/lib/platform/prisma";
import { parseMultipleIds } from "@/lib/core/utils";
import { TimetablePageClient } from "./_components/timetable-page-client";
import { toLocalDateStr, addCalendarDays } from "@/lib/core/date-utils";

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
    tagId?: string | string[];
  }>;
}) {
  const { orgId } = await params;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const rawSearchParams = await searchParams;
  const anchorParam = first(rawSearchParams.anchor);
  const modeParam = first(rawSearchParams.mode);
  const spanParam = first(rawSearchParams.span);
  const urlRoleIds = parseMultipleIds(rawSearchParams.roleId);
  const urlTagIds = parseMultipleIds(rawSearchParams.tagId);

  const { userId } = await requireOrgMemberPage(orgId);

  // ── Cookie-based pref defaults ─────────────────────────────────────────────
  // Read saved prefs from the cookie and use them as server-side defaults so
  // the page always renders with the correct mode/span/filters on the first
  // request — no redirect needed, no calendar→simple flash on the client.
  // TimetableSidebarContent writes the cookie on every pref change so future
  // navigations to the bare URL pick up the correct state instantly.
  const cookieStore = await cookies();
  let savedPrefs: {
    mode?: string;
    span?: string;
    roleIds?: string[];
    tagIds?: string[];
    roleId?: string | null;
    tagId?: string | null;
  } | null = null;
  const rawPrefsCookie = cookieStore.get(`timetable-prefs-${orgId}`)?.value;
  if (rawPrefsCookie) {
    try {
      savedPrefs = JSON.parse(decodeURIComponent(rawPrefsCookie));
    } catch { /* ignore malformed cookie */ }
  }

  // Role/tag: apply cookie as server-side default when the URL has no explicit filter.
  // RoleFilterButton and TagFilterButton both write the cookie before navigating so
  // clearing a filter updates the cookie first — no stuck-filter risk.
  let cookieRoleIds: string[] = [];
  if (savedPrefs?.roleIds && Array.isArray(savedPrefs.roleIds)) {
    cookieRoleIds = savedPrefs.roleIds;
  } else if (typeof savedPrefs?.roleId === "string") {
    cookieRoleIds = [savedPrefs.roleId];
  }

  let cookieTagIds: string[] = [];
  if (savedPrefs?.tagIds && Array.isArray(savedPrefs.tagIds)) {
    cookieTagIds = savedPrefs.tagIds;
  } else if (typeof savedPrefs?.tagId === "string") {
    cookieTagIds = [savedPrefs.tagId];
  }

  const hasUrlRole = rawSearchParams.roleId !== undefined;
  const hasUrlTag = rawSearchParams.tagId !== undefined;

  const rawRoleIds = hasUrlRole ? urlRoleIds : cookieRoleIds;
  const rawTagIds = hasUrlTag ? urlTagIds : cookieTagIds;

  const isModeExplicit = modeParam === "simple" || modeParam === "calendar";
  const isSpanExplicit = spanParam === "day" || spanParam === "week";
  // ──────────────────────────────────────────────────────────────────────────

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

  // Use cookie as fallback when URL has no explicit mode/span, so the page
  // renders with the correct view on bare navigation without any redirect.
  const mode: "calendar" | "simple" =
    modeParam === "simple" ? "simple" :
    modeParam === "calendar" ? "calendar" :
    savedPrefs?.mode === "simple" ? "simple" : "calendar";
  const span: "day" | "week" =
    spanParam === "day" ? "day" :
    spanParam === "week" ? "week" :
    savedPrefs?.span === "day" ? "day" : "week";
  const [
    instances,
    templates,
    tasks,
    memberships,
    currentMembership,
    orgRoles,
    orgTags,
  ] = await Promise.all([
    getRangeTimetableInstances(orgId, orgTz, rangeStart, 13),
    getTimetableTemplates(orgId),
    getInheritedTasks(orgId),
    getMemberships(orgId),
    getOrgMembership(orgId, userId),
    getRoles(orgId),
    getOrgTags(orgId),
  ]);

  const canManageTimetable = currentMembership
    ? await memberHasPermission(
        currentMembership.id,
        orgId,
        PermissionAction.MANAGE_TIMETABLE,
      )
    : false;

  // Build membership→roles map for client rendering
  const clientMemberships = memberships.map(
    (m: (typeof memberships)[number]) => ({
      id: m.id,
      user: m.user ? { id: m.user.id, name: m.user.name } : null,
      botName: m.botName ?? null,
      roles: m.memberRoles.map((mr: (typeof m.memberRoles)[number]) => ({
        id: mr.role.id,
        name: mr.role.name,
        color: mr.role.color,
      })),
    }),
  );

  // Roles for filter dropdown — all org roles
  const filterRoles = orgRoles
    .map((r: (typeof orgRoles)[number]) => ({
      id: r.id,
      name: r.name,
      color: r.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Validate rawRoleIds against the fetched roles to guard against stale cookie IDs.
  const validRoleIds = rawRoleIds.filter((id) => filterRoles.some((r) => r.id === id));

  // Filter instances by task eligibility for the selected roles
  let filteredInstances = instances;
  if (validRoleIds.length > 0) {
    const inheritedTaskIds = tasks.map((t) => t.id);
    const eligibleTaskIds = new Set(
      (
        await prisma.taskEligibility.findMany({
          where: { roleId: { in: validRoleIds }, taskId: { in: inheritedTaskIds } },
          select: { taskId: true },
        })
      ).map((e) => e.taskId),
    );
    filteredInstances = instances.filter((inst) =>
      eligibleTaskIds.has(inst.taskId),
    );
  }

  // Filter instances by tag for the selected tags
  const filterTags = orgTags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));
  const validTagIds = rawTagIds.filter((id) => filterTags.some((t) => t.id === id));
  if (validTagIds.length > 0) {
    const inheritedTaskIds = tasks.map((t) => t.id);
    const taggedTaskIds = new Set(
      (
        await prisma.taskTag.findMany({
          where: { tagId: { in: validTagIds }, taskId: { in: inheritedTaskIds } },
          select: { taskId: true },
        })
      ).map((t) => t.taskId),
    );
    filteredInstances = filteredInstances.filter((inst) =>
      taggedTaskIds.has(inst.taskId),
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
    const inheritedTaskIds = tasks.map((t) => t.id);
    const eligibilities = await prisma.taskEligibility.findMany({
      where: { taskId: { in: inheritedTaskIds } },
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
      if (validRoleIds.length > 0) {
        const filteredRole = t.eligibility.find((e) => validRoleIds.includes(e.role.id));
        return [t.id, filteredRole?.role?.color ?? null];
      }
      return [t.id, t.eligibility[0]?.role?.color ?? null];
    }),
  );
  const coloredInstances = filteredInstances.map((inst) => ({
    ...inst,
    taskColor: taskRoleColorMap.get(inst.taskId) ?? null,
  }));

  const taskColors: Record<
    string,
    { color: string | null; roleColor: string | null; tagColor: string | null }
  > = {};
  for (const t of tasks) {
    const displayRole = validRoleIds.length > 0
      ? t.eligibility.find((e) => validRoleIds.includes(e.role.id))?.role
      : t.eligibility[0]?.role;
    const displayTag = validTagIds.length > 0
      ? t.tags.find((tt) => validTagIds.includes(tt.tag.id))?.tag
      : t.tags[0]?.tag;
    taskColors[t.id] = {
      color: t.color ?? null,
      roleColor: displayRole?.color ?? null,
      tagColor: displayTag?.color ?? null,
    };
  }

  const isFiltersExplicit = hasUrlRole || hasUrlTag;
  const templateOptions = templates.map((t) => ({
    id: t.id,
    name: t.name,
    cycleLengthDays: t.cycleLengthDays,
  }));

  const availableTasks = canManageTimetable
    ? tasks.map((t) => {
        const displayRole = validRoleIds.length > 0
          ? t.eligibility.find((e) => validRoleIds.includes(e.role.id))?.role
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
    : undefined;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh - 148px)", minHeight: "500px" }}
    >
      <TimetablePageClient
        orgId={orgId}
        instances={coloredInstances}
        anchor={anchor}
        openTimeMin={orgMeta?.openTimeMin ?? 360}
        closeTimeMin={orgMeta?.closeTimeMin ?? 1320}
        initialMode={mode}
        initialSpan={span}
        fillHeight
        todayStr={todayStr}
        selectedRoleIds={validRoleIds}
        selectedTagIds={validTagIds}
        roles={filterRoles}
        tags={filterTags}
        canManage={canManageTimetable}
        templates={templateOptions}
        userId={userId}
        tasks={availableTasks}
        taskColors={taskColors}
        memberships={clientMemberships}
        isModeExplicit={isModeExplicit}
        isSpanExplicit={isSpanExplicit}
        isFiltersExplicit={isFiltersExplicit}
      />
    </div>
  );
}
