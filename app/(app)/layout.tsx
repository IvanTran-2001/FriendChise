import { AppSidebar, GlobalSidebarProvider } from "@/components/layout/sidebar";
import { NavBar } from "@/components/layout/navbar";
import { PageSidebarProvider, PageSidebarSlot } from "@/components/layout/page-sidebar-context";
import { ActionSidebarProvider, ActionSidebarSlot } from "@/components/layout/action-sidebar-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageSidebarProvider>
      <ActionSidebarProvider>
        <GlobalSidebarProvider>
          {/* Full-height flex column: navbar on top, sidebar+content row below */}
          <div className="h-dvh flex flex-col">
            <NavBar />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <AppSidebar />
              <PageSidebarSlot />
              <ActionSidebarSlot />
              <div className="flex flex-col flex-1 overflow-hidden">
                <main className="flex-1 min-h-0 overflow-auto flex flex-col p-4 sm:p-6">
                  {children}
                </main>
              </div>
            </div>
          </div>
        </GlobalSidebarProvider>
      </ActionSidebarProvider>
    </PageSidebarProvider>
  );
}
