/**
 * Toolbar — sticky sub-header rendered at the top of page content areas.
 *
 * Sits flush against the page edges by cancelling `<main>`'s padding with
 * negative margins (`-mx-4 -mt-4` / `sm:-mx-6 sm:-mt-6`). Height snaps to
 * exact multiples of 48px (h-12) — it will never grow by a partial row.
 * Use `flex-1` on an input to fill available space, or `ml-auto` on trailing
 * items to push them right.
 */
"use client";

import { ReactNode, useRef, useEffect, useState } from "react";
import { usePageSidebarCollapsed } from "@/components/layout/page-sidebar-context";

const ROW = 48; // h-12

export function Toolbar({ children }: { children: ReactNode }) {
  const sidebarCollapsed = usePageSidebarCollapsed();
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(ROW);

  useEffect(() => {
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
  }, []);

  return (
    <div
      style={{ height }}
      className={`-mx-4 -mt-4 mb-4 border-b bg-card px-4 shrink-0 flex items-center sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6${sidebarCollapsed ? " md:pl-18" : ""}`}
    >
      <div ref={innerRef} className="flex flex-wrap items-center gap-2 w-full">
        {children}
      </div>
    </div>
  );
}
