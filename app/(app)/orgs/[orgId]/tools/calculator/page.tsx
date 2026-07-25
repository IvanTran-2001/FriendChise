import { requireOrgPermissionPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { PermissionAction } from "@prisma/client";
import { CalculatorSidebarContent } from "./_components/calculator-sidebar-content";
import { CalculatorClient } from "./_components/calculator-client";

export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgPermissionPage(orgId, PermissionAction.MANAGE_TASKS);

  return (
    <>
      <RegisterPageSidebar
        title="Calculator"
        content={<CalculatorSidebarContent orgId={orgId} />}
      />
      <CalculatorClient orgId={orgId} />
    </>
  );
}
