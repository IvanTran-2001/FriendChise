/**
 * App shell for signed-in pages.
 * Mounts the demo banner and tour globally for demo users.
 */
import { auth } from "@/auth";
import { AppSidebar, GlobalSidebarProvider } from "@/components/layout/sidebar/sidebar";
import { NavBar } from "@/components/layout/global/navbar";
import {
  PageSidebarProvider,
  PageSidebarSlot,
} from "@/components/layout/contexts/page-sidebar-context";
import {
  ActionSidebarProvider,
  ActionSidebarSlot,
} from "@/components/layout/contexts/action-sidebar-context";
import {
  ToolbarProvider,
  ToolbarSlot,
} from "@/components/layout/contexts/toolbar-context";
import { OrgSettingsPermissionsProvider } from "@/components/layout/contexts/org-settings-permissions-context";
import { DemoBanner } from "@/components/layout/demo-tour/components/demo-banner";
import { DemoTour } from "@/components/layout/demo-tour";
import { ScrollToTopFab } from "@/components/layout/sidebar/scroll-to-top-fab";
import { isDemoEmail } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isDemo = isDemoEmail(session?.user?.email ?? null);

  // Anonymous visitors only ever reach this layout via `/` (every other
  // `(app)` route redirects to /signin before rendering) where they see the
  // public marketing homepage — skip the authenticated app shell entirely.
  if (!session?.user) return <>{children}</>;

  return (
    <PageSidebarProvider>
      <ActionSidebarProvider>
        <GlobalSidebarProvider>
          <ToolbarProvider>
            <OrgSettingsPermissionsProvider>
              <div className="app-root">
                {/* Full-height flex column: navbar on top, sidebar+content row below */}
                <div className="min-h-dvh flex flex-col md:h-dvh">
                  <DemoBanner session={session} />
                  <DemoTour enabled={isDemo} />
                  <NavBar />
                  <div className="flex flex-1 min-h-0 overflow-visible md:overflow-hidden">
                    <AppSidebar />
                    <PageSidebarSlot />
                    <ActionSidebarSlot />
                    <div className="flex flex-col flex-1 overflow-visible md:overflow-hidden">
                      <ToolbarSlot />
                      <div className="app-header-spacer" aria-hidden="true" />
                      <main className="flex-1 min-h-0 overflow-x-hidden flex flex-col p-4 sm:p-6 touch-manipulation md:overflow-y-auto" data-tour-target="workspace">
                        {children}
                      </main>
                      <ScrollToTopFab />
                    </div>
                  </div>
                </div>
              </div>
            </OrgSettingsPermissionsProvider>
          </ToolbarProvider>
        </GlobalSidebarProvider>
      </ActionSidebarProvider>
    </PageSidebarProvider>
  );
}
