"use client";

/**
 * TimetableViewPicker — paired segmented controls for the timetable view mode.
 *
 * Renders two SegmentedControl groups:
 *  - Calendar / Simple  (mode)
 *  - Day / Week         (span)
 *
 * The picker updates the URL in place and notifies the parent so the view
 * switches immediately without a route navigation.
 */
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface TimetableViewPickerProps {
  orgId: string;
  anchor: string;
  mode: "calendar" | "simple";
  span: "day" | "week";
  roleId?: string | null;
  tagId?: string | null;
  onModeChange: (mode: "calendar" | "simple") => void;
  onSpanChange: (span: "day" | "week") => void;
  /** Extra classes applied to the outer wrapper (e.g. "flex-col" in sidebars). */
  className?: string;
}

export function TimetableViewPicker({
  orgId,
  anchor,
  mode,
  span,
  roleId,
  tagId,
  onModeChange,
  onSpanChange,
  className,
}: TimetableViewPickerProps) {
  function buildHref(nextMode: "calendar" | "simple", nextSpan: "day" | "week") {
    const params = new URLSearchParams({ anchor, mode: nextMode, span: nextSpan });
    if (roleId) params.set("roleId", roleId);
    if (tagId) params.set("tagId", tagId);
    return `/orgs/${orgId}/timetable?${params.toString()}`;
  }

  function setMode(nextMode: "calendar" | "simple") {
    window.history.replaceState(null, "", buildHref(nextMode, span));
    onModeChange(nextMode);
  }

  function setSpan(nextSpan: "day" | "week") {
    window.history.replaceState(null, "", buildHref(mode, nextSpan));
    onSpanChange(nextSpan);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Day / Week */}
      <SegmentedControl
        options={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
        ]}
        value={span}
        onChange={(v) => setSpan(v as "day" | "week")}
      />

      {/* Calendar / Simple */}
      <SegmentedControl
        options={[
          { label: "Calendar", value: "calendar" },
          { label: "Simple", value: "simple" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as "calendar" | "simple")}
      />
    </div>
  );
}
