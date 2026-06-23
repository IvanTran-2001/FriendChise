"use client";

import type { ReactNode } from "react";

type DocSidebarScrollFrameProps = {
  children: ReactNode;
};

export function DocSidebarScrollFrame({
  children,
}: DocSidebarScrollFrameProps) {
  return (
    <div className="h-full overflow-y-auto rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      {children}
    </div>
  );
}
