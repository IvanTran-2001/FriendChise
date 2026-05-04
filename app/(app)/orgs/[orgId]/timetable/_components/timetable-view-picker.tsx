"use client";

/**
 * TimetableViewPicker — paired segmented controls for the timetable view mode.
 *
 * Renders two SegmentedControl groups:
 *  - Calendar / Simple  (mode)
 *  - Day / Week         (span)
 *
 * All state is URL-driven — switching calls `router.push()` with the new
 * href, so mode/span persist across navigation and page refreshes.
 * A `useTransition` keeps the button interactive while the navigation is
 * pending.
 *
 * Accepts an optional `className` for layout adjustments (e.g. `flex-col
 * items-start` when rendered in a narrow sidebar vs. the toolbar).
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface TimetableViewPickerProps {
  mode: "calendar" | "simple";
  span: "day" | "week";
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
  /** Extra classes applied to the outer wrapper (e.g. "flex-col" in sidebars). */
  className?: string;
}

export function TimetableViewPicker({
  mode,
  span,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
  className,
}: TimetableViewPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string, meta?: { mode?: string; span?: string }) =>
    startTransition(() => {
      if (meta) {
        try {
          if (meta.mode) localStorage.setItem("timetable:mode", meta.mode);
          if (meta.span) localStorage.setItem("timetable:span", meta.span);
        } catch {
          /* ignore */
        }
      }
      router.push(href);
    });

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isPending && "pointer-events-none opacity-50",
        className,
      )}
    >
      {/* Day / Week */}
      <SegmentedControl
        options={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
        ]}
        value={span}
        onChange={(v) =>
          navigate(v === "day" ? dayHref : weekHref, { span: v })
        }
      />

      {/* Calendar / Simple */}
      <SegmentedControl
        options={[
          { label: "Calendar", value: "calendar" },
          { label: "Simple", value: "simple" },
        ]}
        value={mode}
        onChange={(v) =>
          navigate(v === "calendar" ? calendarHref : simpleHref, { mode: v })
        }
      />
    </div>
  );
}
