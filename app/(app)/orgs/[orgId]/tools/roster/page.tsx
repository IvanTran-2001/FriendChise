/**
 * RosterPage — fetches roster data and renders the interactive board.
 */
import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { getRoles } from "@/lib/services/roles";
import {
  getRosterEntries,
  getRosterDayConfigs,
  getOrgMembersForRoster,
  getOrgSchedule,
  getRosterTemplates,
} from "@/lib/services/roster";
import { RosterPageClient } from "./_components/roster-page-client";

// Pre-fetch 8 weeks centred on today so the initial render has data
// without a client round-trip. The client can navigate further freely.
function getInitialWeekStarts(): Date[] {
  const today = new Date();
  const day = today.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i * 7);
    return d;
  });
}

export default async function RosterPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { userId } = await requireOrgMemberPage(orgId);

  const weekStarts = getInitialWeekStarts();

  const [entries, dayConfigs, members, membership, roles, orgSchedule, templates] =
    await Promise.all([
      getRosterEntries(orgId, weekStarts),
      getRosterDayConfigs(orgId),
      getOrgMembersForRoster(orgId),
      getOrgMembership(orgId, userId),
      getRoles(orgId),
      getOrgSchedule(orgId),
      getRosterTemplates(orgId),
    ]);

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_MEMBERS,
      )
    : false;

  return (
    <RosterPageClient
      orgId={orgId}
      entries={entries}
      dayConfigs={dayConfigs}
      members={members}
      roles={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
      templates={templates.map((t) => ({ id: t.id, name: t.name, cycleWeeks: t.cycleWeeks }))}
      canManage={canManage}
      orgOpenTimeMin={orgSchedule.openTimeMin}
      orgCloseTimeMin={orgSchedule.closeTimeMin}
      orgTimezone={orgSchedule.timezone}
    />
  );
}
