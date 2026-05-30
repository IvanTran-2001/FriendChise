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
import { usePageSidebarCollapsed } from "@/components/layout/page-sidebar-context";

const ROW = 48; // h-12

type ToolbarCtxValue = {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
};

const ToolbarCtx = createContext<ToolbarCtxValue>({
  content: null,
  setContent: () => {},
});

export function ToolbarProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  return (
    <ToolbarCtx.Provider value={{ content, setContent }}>
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
  const { content } = useContext(ToolbarCtx);
  const sidebarCollapsed = usePageSidebarCollapsed();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(ROW);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.scrollHeight;
      setHeight(Math.max(ROW, Math.ceil(h / ROW) * ROW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  if (!content) return null;

  return (
    <div
      style={{ height }}
      className={`border-b bg-card shrink-0 flex items-center px-4 sm:px-6${sidebarCollapsed ? " md:pl-18" : ""}`}
    >
      <div ref={innerRef} className="flex flex-wrap items-center gap-2 w-full">
        {content}
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
  const { setContent } = useContext(ToolbarCtx);
  useEffect(() => {
    setContent(children);
    return () => setContent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);
  return null;
}
