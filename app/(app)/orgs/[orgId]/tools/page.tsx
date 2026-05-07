import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { ToolsSidebarContent } from "./_components/tools-sidebar-content";
import { ToolsClient } from "./tools-client";

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  return (
    <>
      <RegisterPageSidebar content={<ToolsSidebarContent />} />
      <ToolsClient />
    </>
  );
}
