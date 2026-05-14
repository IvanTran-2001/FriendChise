import { notFound } from "next/navigation";
import { requireOrgMemberPage } from "@/lib/authz";
import { memberHasPermission, getOrgMembership } from "@/lib/authz/_shared";
import { PermissionAction } from "@prisma/client";
import {
  getRosterTemplate,
  getOrgMembersForRoster,
  getOrgSchedule,
} from "@/lib/services/roster";
import { RosterTemplateEditorClient } from "./_components/roster-template-editor-client";

export default async function RosterTemplateEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; templateId: string }>;
}) {
  const { orgId, templateId } = await params;
  const { userId } = await requireOrgMemberPage(orgId);

  const [template, members, membership, orgSchedule] = await Promise.all([
    getRosterTemplate(orgId, templateId),
    getOrgMembersForRoster(orgId),
    getOrgMembership(orgId, userId),
    getOrgSchedule(orgId),
  ]);

  if (!template) notFound();

  const canManage = membership
    ? await memberHasPermission(membership.id, orgId, PermissionAction.MANAGE_TIMETABLE)
    : false;

  return (
    <RosterTemplateEditorClient
      orgId={orgId}
      templateId={template.id}
      templateName={template.name}
      cycleWeeks={template.cycleWeeks}
      entries={template.entries}
      members={members}
      canManage={canManage}
      orgOpenTimeMin={orgSchedule.openTimeMin}
      orgCloseTimeMin={orgSchedule.closeTimeMin}
    />
  );
}
