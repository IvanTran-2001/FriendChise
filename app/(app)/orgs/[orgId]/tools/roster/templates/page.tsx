import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import { getRosterTemplates } from "@/lib/services/roster";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { RosterTemplatesSidebarContent } from "./_components/roster-templates-sidebar-content";
import { RosterTemplatesClient } from "./_components/roster-templates-client";

export default async function RosterTemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { userId } = await requireOrgMemberPage(orgId);

  const [templates, membership] = await Promise.all([
    getRosterTemplates(orgId),
    getOrgMembership(orgId, userId),
  ]);

  const canManage = membership
    ? await memberHasPermission(
        membership.id,
        orgId,
        PermissionAction.MANAGE_TIMETABLE,
      )
    : false;

  return (
    <>
      <RegisterPageSidebar
        title="Roster"
        content={
          <RosterTemplatesSidebarContent orgId={orgId} canManage={canManage} />
        }
      />

      <RegisterPageToolbar>
        <span className="text-sm font-medium">Roster Templates</span>
      </RegisterPageToolbar>

      <RosterTemplatesClient
          orgId={orgId}
          templates={templates}
          canManage={canManage}
        />
    </>
  );
}
