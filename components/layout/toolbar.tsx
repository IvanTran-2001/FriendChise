import { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b bg-card px-4 py-2 flex flex-wrap items-center gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6 sm:py-2">
      {children}
    </div>
  );
}
