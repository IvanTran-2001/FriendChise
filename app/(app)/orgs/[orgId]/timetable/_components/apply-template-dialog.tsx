"use client";

/**
 * @file apply-template-dialog.tsx
 * Modal dialog for applying a timetable template to a date range.
 *
 * The user picks a template, a start date, and how many times to repeat the
 * cycle. A preview panel shows the resulting date range and warns (with a
 * count) if existing entries would be overwritten.
 *
 * On submit, calls `applyTemplateAction` which deletes all entries in the
 * range and creates new ones from the template.
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyTemplateAction,
  countTimetableEntriesInRangeAction,
} from "@/app/actions/templates";

/** Minimal template data needed for the dropdown and date-range preview. */
export type TemplateOption = {
  id: string;
  name: string;
  cycleLengthDays: number;
};

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  templates: TemplateOption[];
  /** Pre-selected template id (from the timetable's current week start). */
  defaultStartDate: string;
  /** Server-derived "today" date string (YYYY-MM-DD) in org timezone. */
  todayStr: string;
  /** Current user's ID — used to scope the past warning suppression per user. */
  userId?: string;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Formats a date range as "Mon D – Mon D, YYYY" given a start date and total day count. */
function formatDateRange(startDateStr: string, totalDays: number): string {
  const s = new Date(startDateStr + "T00:00:00Z");
  const e = new Date(startDateStr + "T00:00:00Z");
  e.setUTCDate(e.getUTCDate() + totalDays - 1);
  return `${MONTH_NAMES[s.getUTCMonth()]} ${s.getUTCDate()} \u2013 ${MONTH_NAMES[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

/**
 * Dialog for selecting and applying a template to the live timetable.
 * Reactively fetches the count of existing entries in the target range so
 * the replacement warning is only shown when there is actually something to overwrite.
 *
 * Also exported for use in the ActionSidebar (outside a Dialog wrapper).
 */
export function ApplyTemplateForm({
  onOpenChange,
  orgId,
  templates,
  defaultStartDate,
  todayStr,
  userId,
}: Omit<ApplyTemplateDialogProps, "open">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [cycleRepeats, setCycleRepeats] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState<number>(0);
  const [showPastWarning, setShowPastWarning] = useState(false);
  const [suppressToday, setSuppressToday] = useState(false);

  const SUPPRESS_KEY = userId
    ? `apply-template-past-warn-suppress:${userId}`
    : "apply-template-past-warn-suppress";

  function isSuppressed(): boolean {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SUPPRESS_KEY);
    if (!stored) return false;
    return Date.now() < Number(stored);
  }

  const selected = templates.find((t) => t.id === selectedId);
  const totalDays = selected ? selected.cycleLengthDays * cycleRepeats : 0;
  const dateRangeLabel =
    selected && startDate ? formatDateRange(startDate, totalDays) : null;

  useEffect(() => {
    if (!startDate || totalDays === 0) return;
    let cancelled = false;
    countTimetableEntriesInRangeAction(orgId, startDate, totalDays)
      .then((res) => {
        if (!cancelled) setExistingCount(res.ok ? (res.count ?? 0) : 0);
      })
      .catch(() => {
        if (!cancelled) setExistingCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, startDate, totalDays]);

  function doApply() {
    setError(null);
    startTransition(async () => {
      const result = await applyTemplateAction(
        orgId,
        selectedId,
        startDate,
        cycleRepeats,
      );
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        setShowPastWarning(false);
        return;
      }
      onOpenChange(false);
      router.push(`/orgs/${orgId}/timetable?week=${startDate}`);
      router.refresh();
    });
  }

  function handleApply() {
    if (!selectedId || !startDate || cycleRepeats < 1) return;
    if (startDate < todayStr && !isSuppressed()) {
      setShowPastWarning(true);
      return;
    }
    doApply();
  }

  function handleConfirmPast() {
    if (suppressToday) {
      localStorage.setItem(
        SUPPRESS_KEY,
        String(Date.now() + 24 * 60 * 60 * 1000),
      );
    }
    setShowPastWarning(false);
    doApply();
  }

  if (showPastWarning) {
    return (
      <>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex gap-3">
            <TriangleAlertIcon className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-destructive">
                Applying to past dates
              </p>
              <p className="text-xs text-muted-foreground">
                The start date <span className="font-medium">{startDate}</span>{" "}
                is in the past. Applying a template will overwrite any existing
                entries in that range.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary rounded"
              checked={suppressToday}
              onChange={(e) => setSuppressToday(e.target.checked)}
            />
            Don&apos;t warn me again for 24 hours
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPastWarning(false)}
            disabled={isPending}
          >
            Go Back
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirmPast}
            disabled={isPending}
          >
            {isPending ? "Applying…" : "Apply Anyway"}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Template select */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="apply-template-template"
            className="text-xs font-medium text-muted-foreground"
          >
            Template
          </label>
          <select
            id="apply-template-template"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {templates.length === 0 && (
              <option value="" disabled>
                No templates available
              </option>
            )}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.cycleLengthDays} day
                {t.cycleLengthDays !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="apply-template-start-date"
            className="text-xs font-medium text-muted-foreground"
          >
            Start Date
          </label>
          <Input
            id="apply-template-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* Cycle repeat */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="apply-template-cycle-repeat"
            className="text-xs font-medium text-muted-foreground"
          >
            Cycle Repeat
          </label>
          <Input
            id="apply-template-cycle-repeat"
            type="number"
            min={1}
            max={52}
            step={1}
            value={cycleRepeats}
            onChange={(e) => {
              const next = e.currentTarget.valueAsNumber;
              setCycleRepeats(
                Number.isFinite(next)
                  ? Math.max(1, Math.min(52, Math.trunc(next)))
                  : 1,
              );
            }}
          />
        </div>

        {/* Preview */}
        {selected && dateRangeLabel && (
          <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-sm text-amber-900 flex flex-col gap-2">
            <div className="flex gap-2">
              <InfoIcon className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-medium">
                  {selected.name} × {cycleRepeats}
                </span>
                <div className="text-xs mt-0.5 text-amber-700">
                  {dateRangeLabel}
                </div>
              </div>
            </div>
            {existingCount > 0 && (
              <div className="flex gap-2">
                <TriangleAlertIcon className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span className="text-xs text-amber-700">
                  {existingCount} existing entr
                  {existingCount === 1 ? "y" : "ies"} in this range will be
                  replaced.
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={isPending || !selectedId || templates.length === 0}
        >
          {isPending ? "Applying…" : "Apply"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  orgId,
  templates,
  defaultStartDate,
  todayStr,
  userId,
}: ApplyTemplateDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 flex flex-col rounded-t-2xl overflow-hidden">
        <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
          <SheetTitle>Apply Template</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {open && (
            <ApplyTemplateForm
              onOpenChange={onOpenChange}
              orgId={orgId}
              templates={templates}
              defaultStartDate={defaultStartDate}
              todayStr={todayStr}
              userId={userId}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
