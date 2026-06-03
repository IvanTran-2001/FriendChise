"use client";

/**
 * ActionSidebarContext — imperative panel system for contextual detail/edit
 * views that appear beside the page sidebar on demand.
 *
 * How it works:
 *   1. `ActionSidebarProvider` wraps the layout and holds a single `panel`
 *      state — either null (closed) or { title, content }.
 *   2. Any client component calls `useActionSidebar().open(title, <Panel />)`
 *      to swap in new content, or `.close()` to dismiss it.
 *   3. `ActionSidebarSlot` reads the panel state and renders it:
 *        - Desktop → inline sidebar column (hidden md:flex)
 *        - Mobile  → bottom Sheet
 *   4. The panel auto-closes on route change.
 *
 * Two contexts are used intentionally:
 *   - `ActionSidebarCtx` — public API (open/close/activeTitle), exposed via
 *     `useActionSidebar`. Wide audience: any trigger button can call it.
 *   - `ActionSidebarPanelCtx` — internal panel state, only consumed by
 *     `ActionSidebarSlot`. Kept separate so triggers don't re-render when
 *     panel content changes.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePageSidebarCollapsed } from "@/components/layout/page-sidebar-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionPanel = { title: string; content: ReactNode } | null;

type ActionSidebarCtxValue = {
  open: (title: string, content: ReactNode) => void;
  close: () => void;
  /** Title of the currently open panel, or null if closed. Useful for
   *  highlighting the trigger button that opened the panel. */
  activeTitle: string | null;
};

// ── Contexts ──────────────────────────────────────────────────────────────────

/** Public API context — consumed by trigger buttons via `useActionSidebar`. */
const ActionSidebarCtx = createContext<ActionSidebarCtxValue>({
  open: () => {},
  close: () => {},
  activeTitle: null,
});

/** Internal context — consumed only by `ActionSidebarSlot` to render the panel. */
const ActionSidebarPanelCtx = createContext<{
  panel: ActionPanel;
  close: () => void;
}>({ panel: null, close: () => {} });

// ── Provider ──────────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Call from any client component to open or close the action sidebar panel. */
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
  const isMobile = useIsMobile();

  // ── All hooks must be called unconditionally ──────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(260);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  // Auto-close when the user navigates to a different page.
  useEffect(() => {
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    // Handle is on the LEFT edge — dragging left widens, right narrows
    const delta = startX.current - e.clientX;
    setWidth(Math.min(600, Math.max(200, startW.current + delta)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Don't render anything until after hydration so isMobile is accurate
  if (!mounted) return null;

  // ── Mobile: bottom sheet ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <Sheet open={!!panel} onOpenChange={(o) => !o && close()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="px-0 pb-0 gap-0"
        >
          <SheetHeader className="h-12 flex-row items-center justify-between border-b border-border px-4 py-0 shrink-0">
            <SheetTitle className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              {panel?.title}
            </SheetTitle>
            <button
              onClick={close}
              className="w-10 h-10 shrink-0 rounded-md flex items-center justify-center text-primary hover:bg-primary/8 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </SheetHeader>
          <div className="flex flex-col overflow-y-auto overflow-x-hidden gap-4">
            {panel?.content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: inline sidebar ───────────────────────────────────────────────
  if (!panel) return null;

  return (
    <div
      className="hidden md:flex flex-col shrink-0 border-r border-border bg-sidebar overflow-hidden relative"
      style={{ width }}
    >
      {/* Drag-to-resize handle on the left edge */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute left-0 inset-y-0 w-1 z-20 cursor-col-resize group hover:bg-primary/30 active:bg-primary/50 transition-colors"
        aria-hidden
      />

      {/* Header */}
      <div
        className={`h-12 flex items-center justify-between border-b border-border shrink-0 ${sidebarCollapsed ? "pl-14" : "pl-4"}`}
      >
        <span className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider truncate">
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
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden gap-4">
        {panel.content}
      </div>
    </div>
  );
}
