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
