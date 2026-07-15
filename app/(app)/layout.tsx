/**
 * App shell for signed-in pages.
 * Mounts the demo banner and tour globally for demo users.
 */
import { auth } from "@/auth";
import { AppSidebar, GlobalSidebarProvider } from "@/components/layout/sidebar";
import { NavBar } from "@/components/layout/navbar";
import {
  PageSidebarProvider,
  PageSidebarSlot,
} from "@/components/layout/page-sidebar-context";
import {
  ActionSidebarProvider,
  ActionSidebarSlot,
} from "@/components/layout/action-sidebar-context";
import {
  ToolbarProvider,
  ToolbarSlot,
} from "@/components/layout/toolbar-context";
import { OrgSettingsPermissionsProvider } from "@/components/layout/org-settings-permissions-context";
import { DemoBanner } from "@/components/layout/demo-tour/components/demo-banner";
import { DemoTour } from "@/components/layout/demo-tour";
import { ScrollToTopFab } from "@/components/layout/scroll-to-top-fab";
import { isDemoEmail } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isDemo = isDemoEmail(session?.user?.email ?? null);

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
                  <div className="flex flex-1 min-h-0 overflow-hidden">
                    <AppSidebar />
                    <PageSidebarSlot />
                    <ActionSidebarSlot />
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <ToolbarSlot />
                      <main className="flex-1 min-h-0 overflow-x-hidden flex flex-col p-4 sm:p-6 touch-pan-y md:overflow-y-auto" data-tour-target="workspace">
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
