import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { ItemListSidebarContent } from "./_components/item-list-sidebar-content";

export default async function ItemListPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  return (
    <>
      <RegisterPageSidebar
        content={<ItemListSidebarContent orgId={orgId} />}
      />
      <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </>
  );
}
