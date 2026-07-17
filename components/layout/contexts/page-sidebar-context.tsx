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
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useMobileSidebar } from "@/components/layout/contexts/mobile-sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";

type PageSidebarCtxValue = {
  sidebar: ReactNode | null;
  setSidebar: (node: ReactNode | null) => void;
  sidebarTitle: string | null;
  setSidebarTitle: (title: string | null) => void;
  subContent: ReactNode | null;
  setSubContent: (node: ReactNode | null) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const PageSidebarCtx = createContext<PageSidebarCtxValue>({
  sidebar: null,
  setSidebar: () => {},
  sidebarTitle: null,
  setSidebarTitle: () => {},
  subContent: null,
  setSubContent: () => {},
  collapsed: false,
  setCollapsed: () => {},
});

export function PageSidebarProvider({ children }: { children: ReactNode }) {
  const [sidebar, setSidebar] = useState<ReactNode | null>(null);
  const [sidebarTitle, setSidebarTitle] = useState<string | null>(null);
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
        sidebarTitle,
        setSidebarTitle,
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
  const { sidebar, sidebarTitle, collapsed, setCollapsed } = useContext(PageSidebarCtx);
  const { open, setOpen } = useMobileSidebar();

  if (!sidebar) return null;

  const titleEl = sidebarTitle ? (
    <span className="flex-1 pl-4 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider truncate">
      {sidebarTitle}
    </span>
  ) : <span className="flex-1" />;

  return (
    <>
      {/* Desktop */}
      {collapsed ? (
        /* Collapsed: zero-width, button floats over content */
        <div className="hidden md:block relative w-0 shrink-0">
          <button
            onClick={() => setCollapsed(false)}
            className="absolute top-0 left-0 z-50 flex items-center justify-center w-12 h-12 rounded-none bg-sidebar border-r border-b border-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors cursor-pointer"
            aria-label="Expand sidebar"
            data-tour-target="page-sidebar-expand"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      ) : (
        /* Expanded: in-flow panel, header row holds the collapse button */
        <div className="hidden md:flex flex-col w-75 shrink-0 border-r border-border bg-sidebar overflow-hidden" data-tour-target="page-sidebar">
          {/* Sticky header */}
          <div className="h-12 flex items-center shrink-0 border-b border-border">
            {titleEl}
            <button
              onClick={() => setCollapsed(true)}
              className="w-12 h-12 shrink-0 flex items-center justify-center rounded-none border-l border-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors cursor-pointer"
              aria-label="Collapse sidebar"
              data-tour-target="page-sidebar-collapse"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
          {/* Scrollable content */}
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {sidebar}
          </div>
        </div>
      )}

      {/* Mobile: overlay anchored right of the AppSidebar icon strip */}
      {open && (
        <div className="md:hidden fixed inset-y-0 left-12 z-50 flex flex-col w-75 bg-sidebar border-r border-border" data-tour-target="page-sidebar">
          {/* Sticky header */}
          <div className="h-12 flex items-center shrink-0 border-b border-border">
            {titleEl}
            <button
              onClick={() => setOpen(false)}
              className="w-12 h-12 shrink-0 flex items-center justify-center rounded-none border-l border-border text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
              aria-label="Close"
              data-tour-target="page-sidebar-collapse"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
            {sidebar}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Register a page-level sidebar from any layout.
 * Clears automatically when the layout unmounts (route group change).
 */
export function RegisterPageSidebar({
  content,
  title,
}: {
  content: ReactNode;
  title?: string;
}) {
  const { setSidebar, setSidebarTitle } = useContext(PageSidebarCtx);
  useEffect(() => {
    setSidebar(content);
    if (title !== undefined) setSidebarTitle(title);
    return () => {
      setSidebar(null);
      if (title !== undefined) setSidebarTitle(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, title]);
  return null;
}

/**
 * Set (or update) only the sidebar title without replacing the sidebar content.
 * Useful when a page only calls RegisterPageSidebarSubContent but still needs
 * a title in the header.
 */
export function RegisterPageSidebarTitle({ title }: { title: string }) {
  const { setSidebarTitle } = useContext(PageSidebarCtx);
  useEffect(() => {
    setSidebarTitle(title);
    return () => setSidebarTitle(null);
  }, [title, setSidebarTitle]);
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
