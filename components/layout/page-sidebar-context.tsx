"use client";

/**
 * PageSidebarContext — wires a page-level sidebar panel into the app layout.
 *
 * How it works:
 *  1. `AppLayout` renders a `<PageSidebarSlot>` beside `<main>`. Initially the
 *     slot is collapsed (zero width).
 *  2. A page that wants a sidebar calls `<RegisterPageSidebar>` anywhere in its
 *     tree. That component pushes its children into the slot via context.
 *  3. `PageSidebarSlot` renders the slot in two states:
 *     - **Collapsed**: `w-0` with an absolute open-button (`w-12 h-12`,
 *       `rounded-none`, `border-r border-b`) anchored to the top-left corner.
 *     - **Expanded**: `w-65` flex column with a close-button (`w-12 h-12`,
 *       `rounded-none`, `border-b border-l`) at the top-right.
 *  4. Open/closed state is persisted in `localStorage` via `usePersistedState`
 *     so the sidebar remembers its position across page navigations.
 *  5. On mobile (`< md`) the sidebar renders as a fixed overlay (`left-12`) and
 *     is controlled by `MobileSidebarCtx`.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";

type PageSidebarCtxValue = {
  sidebar: ReactNode | null;
  setSidebar: (node: ReactNode | null) => void;
  subContent: ReactNode | null;
  setSubContent: (node: ReactNode | null) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const PageSidebarCtx = createContext<PageSidebarCtxValue>({
  sidebar: null,
  setSidebar: () => {},
  subContent: null,
  setSubContent: () => {},
  collapsed: false,
  setCollapsed: () => {},
});

export function PageSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebar, setSidebar] = useState<ReactNode | null>(null);
  const [subContent, setSubContent] = useState<ReactNode | null>(null);
  const [collapsed, setCollapsed] = usePersistedState(
    "page-sidebar-collapsed",
    false,
  );
  return (
    <PageSidebarCtx.Provider
      value={{
        sidebar,
        setSidebar,
        subContent,
        setSubContent,
        collapsed,
        setCollapsed,
      }}
    >
      {children}
    </PageSidebarCtx.Provider>
  );
}

/** Returns whether a page sidebar is currently registered. */
export function useHasPageSidebar() {
  return useContext(PageSidebarCtx).sidebar !== null;
}

/** Returns whether the page sidebar is collapsed. */
export function usePageSidebarCollapsed() {
  const { sidebar, collapsed } = useContext(PageSidebarCtx);
  return sidebar !== null && collapsed;
}

/**
 * Renders the registered page sidebar.
 * - Desktop: inline in the flex layout
 * - Mobile: fixed overlay at left-12 (right next to AppSidebar) when hamburger is open
 */
export function PageSidebarSlot() {
  const { sidebar, collapsed, setCollapsed } = useContext(PageSidebarCtx);
  const { open } = useMobileSidebar();

  if (!sidebar) return null;

  return (
    <>
      {/* Desktop */}
      {collapsed ? (
        /* Collapsed: zero-width, button floats over content */
        <div className="hidden md:block relative w-0 shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="absolute top-0 left-0 z-10 flex items-center justify-center w-12 h-12 rounded-none bg-sidebar border-r border-b border-border text-primary hover:bg-primary/8 transition-colors cursor-pointer"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      ) : (
        /* Expanded: in-flow panel, button floats absolute over content */
        <div className="hidden md:flex flex-col relative w-65 shrink-0 border-r border-border bg-sidebar overflow-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {sidebar}
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="absolute top-0 right-0 z-10 flex items-center justify-center w-12 h-12 rounded-none border-b border-l border-border text-primary hover:bg-primary/8 transition-colors cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Mobile: overlay anchored right of the AppSidebar icon strip */}
      {open && (
        <div className="md:hidden fixed inset-y-0 left-12 z-50 flex flex-col w-65 bg-sidebar border-r border-border overflow-y-auto max-h-screen">
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

/**
 * Register sub-content to be rendered inside the active page sidebar shell.
 * Unlike RegisterPageSidebar (which replaces the entire sidebar), this only
 * swaps the inner content — the shell (e.g. nav tabs) stays mounted and
 * visible during navigation, eliminating sidebar flicker.
 */
export function RegisterPageSidebarSubContent({
  content,
}: {
  content: ReactNode;
}) {
  const { setSubContent } = useContext(PageSidebarCtx);
  useEffect(() => {
    setSubContent(content);
    return () => setSubContent(null);
  }, [content, setSubContent]);
  return null;
}

/** Reads the sub-content registered by the current page (for use inside sidebar shells). */
export function usePageSidebarSubContent() {
  return useContext(PageSidebarCtx).subContent;
}
