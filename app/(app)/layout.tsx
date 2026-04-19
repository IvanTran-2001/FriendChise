/**
 * Authenticated app shell layout.
 *
 * Scroll containment strategy:
 * - `h-dvh` on `SidebarProvider` constrains the layout to the viewport so the body never scrolls.
 * - `overflow-hidden` on `SidebarInset` scopes clipping to the right-hand column only
 *   (sidebar is unaffected), preventing navbar items from being clipped at high zoom levels.
 * - `<main>` (`overflow-auto flex-1 min-h-0`) is the actual scroll container.
 *
 * Fixed-toolbar pattern for child pages:
 * Wrap content in `<div className="flex flex-col h-full">`. Place `<Toolbar>` at the top
 * (static), then a `<div className="flex-1 overflow-auto -mx-4 sm:-mx-6 …">` for the
 * scrollable list. Negative horizontal margins cancel `<main>`'s padding so the list
 * extends edge-to-edge; padding is re-applied inside the div.
 */
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { NavBar } from "@/components/layout/navbar";
import { PageHeader } from "@/components/layout/page-header";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";

/**
 * Authenticated app shell shared by all pages under `(app)/`.
 *
 * Composes the collapsible sidebar, top navbar (server component), and the
 * purple breadcrumb header into a standard two-column layout. Page content
 * is rendered inside `<main>` via the `children` slot.
 *
 * `h-dvh overflow-hidden` on SidebarProvider constrains the shell to the
 * viewport height so that `<main>` (overflow-auto) is the scroll container —
 * not the body. This makes `sticky` positioning work inside <main>.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-dvh">
      <BreadcrumbProvider>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <NavBar />
          <PageHeader />
          <main className="flex-1 min-h-0 overflow-auto flex flex-col p-4 sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
