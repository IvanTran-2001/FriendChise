import { PermissionAction } from "@prisma/client";
import { requireOrgPermissionPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { ScanToTaskSidebarContent } from "./_components/scan-to-task-sidebar-content";
import { ScanToTaskClient } from "./scan-to-task-client";

export default async function ScanToTaskPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  return (
    <>
      <RegisterPageSidebar
        title="Scan to Task"
        content={<ScanToTaskSidebarContent />}
      />
      <ScanToTaskClient orgId={orgId} />
    </>
  );
}