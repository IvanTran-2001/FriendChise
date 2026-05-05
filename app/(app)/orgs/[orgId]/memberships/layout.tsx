import type { ReactNode } from "react";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { MembersSidebarShell } from "./_components/members-sidebar-shell";

export default function MembershipsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <RegisterPageSidebar content={<MembersSidebarShell />} />
      {children}
    </>
  );
}
