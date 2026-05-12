import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { getConversionSets } from "@/lib/services/tools";
import { ConversionSidebarContent } from "./_components/conversion-sidebar-content";
import { ConversionClient } from "./conversion-client";

export default async function ConversionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  const sets = await getConversionSets(orgId);

  return (
    <>
      <RegisterPageSidebar
        content={<ConversionSidebarContent orgId={orgId} />}
      />
      <ConversionClient orgId={orgId} sets={sets} />
    </>
  );
}
