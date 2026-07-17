import { RegisterPageSidebar } from "@/components/layout/contexts/page-sidebar-context";
import { MenuSidebarShell } from "./_components/menu-sidebar-shell";

/**
 * Menu tool layout.
 * Wraps the menu routes in the shared page-sidebar shell so the list and
 * detail pages inherit the same left-rail navigation.
 */

export default function MenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RegisterPageSidebar title="Menu" content={<MenuSidebarShell />} />
      {children}
    </>
  );
}