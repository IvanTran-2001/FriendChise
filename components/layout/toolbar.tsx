/**
 * Toolbar — sticky sub-header rendered at the top of page content areas.
 *
 * Sits flush against the page edges by cancelling `<main>`'s padding with
 * negative margins (`-mx-4 -mt-4` / `sm:-mx-6 sm:-mt-6`). Minimum height is
 * 48px (matching the navbar); grows in row increments when children wrap.
 * Use `flex-1` on an input to fill available space, or `ml-auto` on trailing
 * items to push them right. Avoid large `py-*` on direct children — the
 * toolbar's own `py-2` provides the vertical rhythm.
 */
import { ReactNode } from "react";

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b bg-card px-4 min-h-12 py-2 shrink-0 flex flex-wrap items-center gap-2 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
      {children}
    </div>
  );
}
