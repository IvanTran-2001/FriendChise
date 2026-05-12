import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { getConversionSets } from "@/lib/services/tools";
import { ToolsSidebarContent } from "./_components/tools-sidebar-content";
import { ToolsClient } from "./tools-client";

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  const recentSets = await getConversionSets(orgId);

  return (
    <>
      <RegisterPageSidebar content={<ToolsSidebarContent orgId={orgId} />} />
      <ToolsClient orgId={orgId} recentSets={recentSets} />
    </>
  );
}
