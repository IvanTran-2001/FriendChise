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
 */
function ApplyTemplateForm({
  onOpenChange,
  orgId,
  templates,
  defaultStartDate,
}: Omit<ApplyTemplateDialogProps, "open">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [cycleRepeats, setCycleRepeats] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState<number>(0);

  const selected = templates.find((t) => t.id === selectedId);
  const totalDays = selected ? selected.cycleLengthDays * cycleRepeats : 0;
  const dateRangeLabel =
    selected && startDate ? formatDateRange(startDate, totalDays) : null;

  useEffect(() => {
    if (!startDate || totalDays === 0) return;
    let cancelled = false;
    countTimetableEntriesInRangeAction(orgId, startDate, totalDays).then(
      (res) => {
        if (!cancelled) setExistingCount(res.ok ? (res.count ?? 0) : 0);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [orgId, startDate, totalDays]);

  function handleApply() {
    if (!selectedId || !startDate || cycleRepeats < 1) return;
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
        return;
      }
      onOpenChange(false);
      router.push(`/orgs/${orgId}/timetable?week=${startDate}`);
      router.refresh();
    });
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
}: ApplyTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
        </DialogHeader>
        {open && (
          <ApplyTemplateForm
            onOpenChange={onOpenChange}
            orgId={orgId}
            templates={templates}
            defaultStartDate={defaultStartDate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
