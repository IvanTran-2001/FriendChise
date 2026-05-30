import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
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
  await requireOrgMemberPage(orgId);

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
