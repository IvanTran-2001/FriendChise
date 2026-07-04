import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { CalculatorSidebarContent } from "./_components/calculator-sidebar-content";
import { CalculatorClient } from "./_components/calculator-client";

export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  return (
    <>
      <RegisterPageSidebar
        title="Calculator"
        content={<CalculatorSidebarContent orgId={orgId} />}
      />
      <CalculatorClient />
    </>
  );
}
