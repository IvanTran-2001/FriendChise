import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { getConversionSets } from "@/lib/services/tools";
import { hasRosterActivity } from "@/lib/services/roster";
import { ToolsSidebarContent } from "./_components/tools-sidebar-content";
import { ToolsClient } from "./tools-client";

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  const [recentSets, hasRoster] = await Promise.all([
    getConversionSets(orgId),
    hasRosterActivity(orgId),
  ]);

  return (
    <>
      <RegisterPageSidebar title="Tools" content={<ToolsSidebarContent orgId={orgId} />} />
      <ToolsClient
        orgId={orgId}
        recentSets={recentSets}
        hasRoster={hasRoster}
      />
    </>
  );
}
