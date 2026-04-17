"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface TimetableViewPickerProps {
  mode: "calendar" | "simple";
  span: "day" | "week";
  calendarHref: string;
  simpleHref: string;
  dayHref: string;
  weekHref: string;
}

export function TimetableViewPicker({
  mode,
  span,
  calendarHref,
  simpleHref,
  dayHref,
  weekHref,
}: TimetableViewPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Navigate to href using startTransition; also persist the chosen mode/span.
  const navigate = (href: string, meta?: { mode?: string; span?: string }) =>
    startTransition(() => {
      if (meta) {
        try {
          if (meta.mode) localStorage.setItem("timetable:mode", meta.mode);
          if (meta.span) localStorage.setItem("timetable:span", meta.span);
        } catch { /* ignore */ }
      }
      router.push(href);
    });

  const segmentBase = "px-3 py-1 transition-colors cursor-pointer select-none";
  const activeClass = "bg-primary text-primary-foreground";
  const inactiveClass = cn(
    "text-muted-foreground",
    isPending ? "opacity-40" : "hover:bg-muted",
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isPending && "pointer-events-none",
      )}
    >
      {/* Day / Week */}
      <div className="flex rounded-md overflow-hidden border text-sm font-medium">
        <button
          onClick={() => navigate(dayHref, { span: "day" })}
          aria-current={span === "day" ? "page" : undefined}
          className={cn(
            segmentBase,
            span === "day" ? activeClass : inactiveClass,
          )}
        >
          Day
        </button>
        <button
          onClick={() => navigate(weekHref, { span: "week" })}
          aria-current={span === "week" ? "page" : undefined}
          className={cn(
            segmentBase,
            "border-l",
            span === "week" ? activeClass : inactiveClass,
          )}
        >
          Week
        </button>
      </div>

      {/* Calendar / Simple */}
      <div className="flex rounded-md overflow-hidden border text-sm font-medium">
        <button
          onClick={() => navigate(calendarHref, { mode: "calendar" })}
          aria-current={mode === "calendar" ? "page" : undefined}
          className={cn(
            segmentBase,
            mode === "calendar" ? activeClass : inactiveClass,
          )}
        >
          Calendar
        </button>
        <button
          onClick={() => navigate(simpleHref, { mode: "simple" })}
          aria-current={mode === "simple" ? "page" : undefined}
          className={cn(
            segmentBase,
            "border-l",
            mode === "simple" ? activeClass : inactiveClass,
          )}
        >
          Simple
        </button>
      </div>
    </div>
  );
}
