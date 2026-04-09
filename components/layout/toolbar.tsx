import { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-6 -mt-6 mb-6 border-b bg-card px-6 py-2 flex items-center justify-between gap-3">
      {children}
    </div>
  );
}
