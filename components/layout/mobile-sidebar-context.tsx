"use client";

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
