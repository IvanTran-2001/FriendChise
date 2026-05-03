/**
 * OrganizationsLayout — layout for org-management routes (`/orgs/new`, `/orgs/join`, etc.).
 *
 * Registers the `OrgManagementNav` as the page sidebar so all child routes
 * share the same left-hand nav panel without re-fetching or re-mounting it.
 */
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { OrgManagementNav } from "./_components/org-management-nav";

export default function OrganizationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterPageSidebar content={<OrgManagementNav />} />
      {children}
    </>
  );
}
