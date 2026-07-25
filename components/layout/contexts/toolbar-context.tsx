"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePageSidebarCollapsed } from "@/components/layout/contexts/page-sidebar-context";

const ROW = 48; // h-12

type ToolbarCtxValue = {
  mountNode: HTMLElement | null;
  setMountNode: (node: HTMLElement | null) => void;
  hasContent: boolean;
  setHasContent: (value: boolean) => void;
};

const ToolbarCtx = createContext<ToolbarCtxValue>({
  mountNode: null,
  setMountNode: () => {},
  hasContent: false,
  setHasContent: () => {},
});

export function ToolbarProvider({ children }: { children: ReactNode }) {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [hasContent, setHasContent] = useState(false);
  return (
    <ToolbarCtx.Provider value={{ mountNode, setMountNode, hasContent, setHasContent }}>
      {children}
    </ToolbarCtx.Provider>
  );
}

/**
 * Renders the registered toolbar above `<main>` in the app layout.
 * Returns null when no page has registered toolbar content.
 * Height snaps to multiples of 48px, same as the old inline Toolbar.
 */
export function ToolbarSlot() {
  const { setMountNode, hasContent } = useContext(ToolbarCtx);
  const sidebarCollapsed = usePageSidebarCollapsed();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(ROW);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || !hasContent) {
      setMountNode(null);
      return;
    }

    setMountNode(el);

    const measure = () => {
      const h = el.scrollHeight;
      setHeight(Math.max(ROW, Math.ceil(h / ROW) * ROW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setMountNode(null);
    };
  }, [hasContent, setMountNode]);

  // Keep the mobile fixed-overlay spacer (`.app-header-spacer` in globals.css)
  // in sync with the toolbar's actual rendered height.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--toolbar-h",
      hasContent ? `${height}px` : "0px",
    );
    return () => {
      document.documentElement.style.setProperty("--toolbar-h", "0px");
    };
  }, [hasContent, height]);

  if (!hasContent) return null;

  return (
    <div
      style={{ height, top: "var(--safe-header-height)" }}
      className={`fixed inset-x-0 z-30 md:static md:inset-auto border-b bg-card shrink-0 flex items-center px-4 sm:px-6${sidebarCollapsed ? " md:pl-18" : ""}`}
    >
      <div ref={innerRef} className="flex flex-wrap items-center gap-2 w-full">
      </div>
    </div>
  );
}

/**
 * Register toolbar content from any page or client component.
 * Renders nothing itself — content appears in the layout's ToolbarSlot.
 * Clears automatically when the component unmounts.
 */
export function RegisterPageToolbar({ children }: { children: ReactNode }) {
  const { mountNode, setHasContent } = useContext(ToolbarCtx);

  useEffect(() => {
    setHasContent(true);
    return () => setHasContent(false);
  }, [setHasContent]);

  if (!mountNode) return null;

  return createPortal(children, mountNode);
}
