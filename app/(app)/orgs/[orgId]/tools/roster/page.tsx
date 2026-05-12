/**
 * RosterPage — stub page for the Roster tool.
 *
 * Registers `RosterSidebarContent` as the page sidebar so the Back link and
 * title row are rendered. Content is a placeholder until the Roster feature
 * is implemented.
 */
import { requireOrgMemberPage } from "@/lib/authz";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { RosterSidebarContent } from "./_components/roster-sidebar-content";
import { Toolbar } from "@/components/layout/toolbar";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMemberPage(orgId);

  return (
    <>
      <RegisterPageSidebar content={<RosterSidebarContent orgId={orgId} />} />
      <Toolbar>
        <h1 className="text-sm font-semibold">Roster</h1>
      </Toolbar>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted-foreground">No roster entries yet.</p>
      </div>
    </>
  );
}
