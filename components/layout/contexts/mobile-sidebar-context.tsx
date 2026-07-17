"use client";

/**
 * MobileSidebarContext — lightweight boolean context that controls whether the
 * global app sidebar overlay is visible on mobile (`< md` breakpoint).
 *
 * The `AppSidebar` renders a fixed overlay when `open` is true. The hamburger
 * button in `NavBar` calls `setOpen(true)`. Clicking the backdrop or navigating
 * away closes it via `setOpen(false)`.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

type MobileSidebarCtxValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

export const MobileSidebarCtx = createContext<MobileSidebarCtxValue>({
  open: false,
  setOpen: () => {},
});

export function GlobalSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileSidebarCtx.Provider value={{ open, setOpen }}>
      {children}
    </MobileSidebarCtx.Provider>
  );
}

export function useMobileSidebar() {
  return useContext(MobileSidebarCtx);
}
