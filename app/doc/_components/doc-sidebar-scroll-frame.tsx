"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "friendchise-doc-sidebar-scroll-top";

type DocSidebarScrollFrameProps = {
  children: React.ReactNode;
};

export function DocSidebarScrollFrame({
  children,
}: DocSidebarScrollFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const savedScrollTop = window.sessionStorage.getItem(STORAGE_KEY);
    if (savedScrollTop) {
      frame.scrollTop = Number(savedScrollTop) || 0;
    }
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const saveScrollTop = () => {
      window.sessionStorage.setItem(STORAGE_KEY, String(frame.scrollTop));
    };

    frame.addEventListener("scroll", saveScrollTop, { passive: true });
    window.addEventListener("pagehide", saveScrollTop);

    return () => {
      saveScrollTop();
      frame.removeEventListener("scroll", saveScrollTop);
      window.removeEventListener("pagehide", saveScrollTop);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="h-full overflow-y-auto rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm"
    >
      {children}
    </div>
  );
}
