"use client";

import { useBackNavigation } from "@/components/layout/use-back-navigation";

interface BackButtonProps {
  /** Fallback route if there is no browser history to go back to. */
  fallbackHref: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Navigates back using the browser history stack so that going from
 * timetable → task detail → back returns to the timetable (not the task list).
 * Falls back to `fallbackHref` when there is no prior history (direct link open).
 */
export function BackButton({
  fallbackHref,
  children,
  className,
}: BackButtonProps) {
  const handleClick = useBackNavigation(fallbackHref);

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
