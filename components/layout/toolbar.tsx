/**
 * Toolbar — sticky sub-header rendered at the top of page content areas.
 *
 * Sits flush against the page edges by cancelling `<main>`'s padding with
 * negative margins (`-mx-4 -mt-4` / `sm:-mx-6 sm:-mt-6`). Always `h-12`
 * (48px) to align with the navbar, sidebar buttons, and section title rows.
 * Use `flex-1` spacers or `ml-auto` on children to push items to the right.
 */
import { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b bg-card px-4 h-12 shrink-0 flex flex-wrap items-center gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
      {children}
    </div>
  );
}
