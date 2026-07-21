import { requireOrgMemberPage } from "@/lib/authz";
import { getNotePages } from "@/lib/services/tools/notes";
import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { NotesSidebarShell } from "./_components/notes-sidebar-shell";
import { NotesPageClient } from "./_components/notes-page-client";

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ pageId?: string }>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  await requireOrgMemberPage(orgId);

  const pages = await getNotePages(orgId);
  const initialPageId = sp.pageId || pages[0]?.id || "";

  return (
    <>
      <RegisterPageSidebar title="Notes" content={<NotesSidebarShell />} />
      <NotesPageClient orgId={orgId} initialPages={pages} initialPageId={initialPageId} />
    </>
  );
}
