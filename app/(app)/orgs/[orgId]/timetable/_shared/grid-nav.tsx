"use client";

import { Button } from "@/components/ui/button";

interface GridNavProps {
  label: string;
  onPrev: (() => void) | { href: string };
  onNext: (() => void) | { href: string };
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

/**
 * Navigation bar shared by both the timetable week navigator and the
 * template cycle-page navigator.
 *
 * `onPrev`/`onNext` accept either a click handler (template) or an href
 * string (timetable, which uses `<Link>` for full page navigation).
 */
export function GridNav({ label, onPrev, onNext, prevDisabled, nextDisabled }: GridNavProps) {
  const PrevButton = (
    <Button variant="ghost" size="sm" className="gap-1" disabled={prevDisabled}>
      ◀ Prev
    </Button>
  );
  const NextButton = (
    <Button variant="ghost" size="sm" className="gap-1" disabled={nextDisabled}>
      Next ▶
    </Button>
  );

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-1.5">
      {typeof onPrev === "function" ? (
        <span onClick={onPrev}>{PrevButton}</span>
      ) : (
        <a href={onPrev.href}>{PrevButton}</a>
      )}
      <span className="text-sm font-medium">{label}</span>
      {typeof onNext === "function" ? (
        <span onClick={onNext}>{NextButton}</span>
      ) : (
        <a href={onNext.href}>{NextButton}</a>
      )}
    </div>
  );
}
