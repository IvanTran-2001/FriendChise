import type { ReactNode } from "react";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { AnnouncementSidebarShell } from "./_components/announcement-sidebar-shell";

export default function AnnouncementsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RegisterPageSidebar title="Announcements" content={<AnnouncementSidebarShell />} />
      {children}
    </>
  );
}
