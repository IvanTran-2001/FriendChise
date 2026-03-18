import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { NavBar } from "@/components/layout/navbar";
import { PageHeader } from "@/components/layout/page-header";

/**
 * Authenticated app shell shared by all pages under `(app)/`.
 *
 * Composes the collapsible sidebar, top navbar (server component), and the
 * purple breadcrumb header into a standard two-column layout. Page content
 * is rendered inside `<main>` via the `children` slot.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <NavBar />
        <PageHeader />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
