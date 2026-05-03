"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";

type PageSidebarCtxValue = {
  sidebar: ReactNode | null;
  setSidebar: (node: ReactNode | null) => void;
};

const PageSidebarCtx = createContext<PageSidebarCtxValue>({
  sidebar: null,
  setSidebar: () => {},
});

export function PageSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebar, setSidebar] = useState<ReactNode | null>(null);
  return (
    <PageSidebarCtx.Provider value={{ sidebar, setSidebar }}>
      {children}
    </PageSidebarCtx.Provider>
  );
}

/** Returns whether a page sidebar is currently registered. */
export function useHasPageSidebar() {
  return useContext(PageSidebarCtx).sidebar !== null;
}

/**
 * Renders the registered page sidebar.
 * - Desktop: inline in the flex layout
 * - Mobile: fixed overlay at left-12 (right next to AppSidebar) when hamburger is open
 */
export function PageSidebarSlot() {
  const { sidebar } = useContext(PageSidebarCtx);
  const { open } = useMobileSidebar();
  const [collapsed, setCollapsed] = usePersistedState("page-sidebar-collapsed", false);

  if (!sidebar) return null;

  return (
    <>
      {/* Desktop */}
      {collapsed ? (
        /* Collapsed: zero-width, button floats over content */
        <div className="hidden md:block relative w-0 shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="absolute top-0 left-0 z-10 flex items-center justify-center w-12 h-12 rounded-none bg-sidebar border-r border-b border-border text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      ) : (
        /* Expanded: in-flow panel, button floats absolute over content */
        <div className="hidden md:flex flex-col relative w-[260px] shrink-0 border-r border-border bg-sidebar overflow-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {sidebar}
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="absolute top-0 right-0 z-10 flex items-center justify-center w-12 h-12 rounded-none border-b border-l border-border text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Mobile: overlay anchored right of the AppSidebar icon strip */}
      {open && (
        <div className="md:hidden fixed inset-y-0 left-12 z-50 flex flex-col w-[260px] bg-sidebar border-r border-border overflow-y-auto max-h-screen">
          {sidebar}
        </div>
      )}
    </>
  );
}

/**
 * Register a page-level sidebar from any layout.
 * Clears automatically when the layout unmounts (route group change).
 */
export function RegisterPageSidebar({ content }: { content: ReactNode }) {
  const { setSidebar } = useContext(PageSidebarCtx);
  useEffect(() => {
    setSidebar(content);
    return () => setSidebar(null);
  }, [content, setSidebar]);
  return null;
}
