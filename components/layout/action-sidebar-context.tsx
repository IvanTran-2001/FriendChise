"use client";

/**
 * ActionSidebarContext — a transient panel that slides in beside the page
 * sidebar when an action button is clicked.
 *
 * Usage:
 *   const { open, close } = useActionSidebar();
 *   open("Apply Template", <ApplyTemplateForm onOpenChange={close} ... />);
 *
 * The X button (or close()) dismisses the panel.
 * The panel auto-closes on route change.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePageSidebarCollapsed } from "@/components/layout/page-sidebar-context";

type ActionPanel = { title: string; content: ReactNode } | null;

type ActionSidebarCtxValue = {
  open: (title: string, content: ReactNode) => void;
  close: () => void;
  activeTitle: string | null;
};

const ActionSidebarCtx = createContext<ActionSidebarCtxValue>({
  open: () => {},
  close: () => {},
  activeTitle: null,
});

/** Internal context that holds the panel state (consumed by the slot). */
const ActionSidebarPanelCtx = createContext<{
  panel: ActionPanel;
  close: () => void;
}>({ panel: null, close: () => {} });

export function ActionSidebarProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<ActionPanel>(null);

  const open = (title: string, content: ReactNode) =>
    setPanel({ title, content });
  const close = () => setPanel(null);

  return (
    <ActionSidebarCtx.Provider
      value={{ open, close, activeTitle: panel?.title ?? null }}
    >
      <ActionSidebarPanelCtx.Provider value={{ panel, close }}>
        {children}
      </ActionSidebarPanelCtx.Provider>
    </ActionSidebarCtx.Provider>
  );
}

/** Hook for opening/closing the action sidebar from any client component. */
export function useActionSidebar() {
  return useContext(ActionSidebarCtx);
}

/**
 * Renders the action sidebar panel.
 * Place this in the flex row between PageSidebarSlot and <main>.
 */
export function ActionSidebarSlot() {
  const { panel, close } = useContext(ActionSidebarPanelCtx);
  const pathname = usePathname();
  const sidebarCollapsed = usePageSidebarCollapsed();

  // Auto-close when the user navigates to a different page.
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!panel) return null;

  return (
    <div className="hidden md:flex flex-col w-65 shrink-0 border-r border-border bg-sidebar overflow-hidden">
      {/* Header */}
      <div
        className={`h-12 flex items-center justify-between border-b border-border shrink-0 ${sidebarCollapsed ? "pl-14" : "pl-4"}`}
      >
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          {panel.title}
        </span>
        <button
          onClick={close}
          className="w-12 h-12 shrink-0 rounded-none border-l border-border flex items-center justify-center text-primary hover:bg-primary/8 transition-colors cursor-pointer"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-y-auto p-4 gap-4">
        {panel.content}
      </div>
    </div>
  );
}
