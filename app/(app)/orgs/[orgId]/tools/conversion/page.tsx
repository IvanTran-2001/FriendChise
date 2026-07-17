import { requireOrgPermissionPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { PermissionAction } from "@prisma/client";
import {
  getConversionSets,
  getRecentConversionTemplates,
} from "@/lib/services/tools";
import { ConversionSidebarContent } from "./_components/conversion-sidebar-content";
import { ConversionClient } from "./conversion-client";

export default async function ConversionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  const [sets, recentTemplates] = await Promise.all([
    getConversionSets(orgId),
    getRecentConversionTemplates(orgId, 3),
  ]);

  return (
    <>
      <RegisterPageSidebar
        title="Conversion"
        content={<ConversionSidebarContent orgId={orgId} />}
      />
      <ConversionClient
        orgId={orgId}
        sets={sets}
        recentTemplates={recentTemplates}
      />
    </>
  );
}
