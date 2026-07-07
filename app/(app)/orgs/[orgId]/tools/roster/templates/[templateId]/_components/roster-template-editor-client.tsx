"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RegisterPageToolbar } from "@/components/layout/toolbar-context";
import { RegisterPageSidebar } from "@/components/layout/page-sidebar-context";
import { BackSidebarNavItem } from "@/components/layout/back-sidebar-nav-item";
import {
  updateRosterTemplateCycleWeeksAction,
  clearRosterTemplateWeekAction,
} from "@/app/actions/roster";
import { RosterTemplateBoard } from "./roster-template-board";
import {
  ROSTER_CELL_WIDTH,
  ROSTER_DAY_LABEL_WIDTH,
} from "@/app/(app)/orgs/[orgId]/tools/roster/_components/roster-board-constants";
import type { OrgMember } from "@/app/(app)/orgs/[orgId]/tools/roster/_components/roster-board";
import type { TemplateEntryRow } from "./edit-template-cell-panel";

const MIN_CELL_WIDTH = ROSTER_CELL_WIDTH;

interface RosterTemplateEditorSidebarProps {
  orgId: string;
  templateId: string;
  templateName: string;
  cycleWeeks: number;
  entries: TemplateEntryRow[];
  onCycleWeeksChange: (val: number) => void;
  canManage: boolean;
}

function RosterTemplateEditorSidebar({
  orgId,
  templateId,
  templateName: _templateName,
  cycleWeeks,
  entries,
  onCycleWeeksChange,
  canManage,
}: RosterTemplateEditorSidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmWeek, setConfirmWeek] = useState<number | null>(null);

  function handleDecrement() {
    const weekToRemove = cycleWeeks - 1; // 0-based last week
    const hasEntries = entries.some((e) => e.weekIndex === weekToRemove);
    if (hasEntries) {
      setConfirmWeek(weekToRemove);
    } else {
      applyDecrement(weekToRemove, false);
    }
  }

  function applyDecrement(weekToRemove: number, needsClear: boolean) {
    const next = cycleWeeks - 1;
    onCycleWeeksChange(next);
    setConfirmWeek(null);
    startTransition(async () => {
      if (needsClear) {
        const clearResult = await clearRosterTemplateWeekAction(
          orgId,
          templateId,
          weekToRemove,
        );
        if (!clearResult.ok) {
          toast.error(clearResult.error ?? "Failed to clear week");
          onCycleWeeksChange(cycleWeeks);
          return;
        }
      }
      const result = await updateRosterTemplateCycleWeeksAction(
        orgId,
        templateId,
        next,
      );
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update");
        onCycleWeeksChange(cycleWeeks);
      }
    });
  }

  function handleIncrement() {
    const next = cycleWeeks + 1;
    if (next > 12) return;
    onCycleWeeksChange(next);
    startTransition(async () => {
      const result = await updateRosterTemplateCycleWeeksAction(
        orgId,
        templateId,
        next,
      );
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update");
        onCycleWeeksChange(cycleWeeks);
      }
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <BackSidebarNavItem
        title="Back to Templates"
        fallbackHref={`/orgs/${orgId}/tools/roster/templates`}
        icon={ArrowLeft}
      />

      {canManage && (
        <div className="px-3 pt-3 pb-3 border-t border-border flex flex-col gap-3">
          <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider px-1">
            Actions
          </p>

          {/* Cycle weeks stepper */}
          <div className="flex flex-col gap-1.5 px-1">
            <span className="text-xs text-muted-foreground">Cycle weeks</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={cycleWeeks <= 1 || isPending}
                onClick={handleDecrement}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="flex-1 text-center text-sm font-medium tabular-nums">
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                ) : (
                  cycleWeeks
                )}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={cycleWeeks >= 12 || isPending}
                onClick={handleIncrement}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Inline confirm when last week has entries */}
          {confirmWeek !== null && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 flex flex-col gap-2.5">
              <div className="flex gap-2 items-start">
                <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Week {confirmWeek + 1} has shifts assigned. Removing it will
                  delete all of them.
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => setConfirmWeek(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white border-0"
                  onClick={() => applyDecrement(confirmWeek, true)}
                  disabled={isPending}
                >
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RosterTemplateEditorClientProps {
  orgId: string;
  templateId: string;
  templateName: string;
  cycleWeeks: number;
  entries: TemplateEntryRow[];
  members: OrgMember[];
  canManage: boolean;
  orgOpenTimeMin: number | null;
  orgCloseTimeMin: number | null;
}

export function RosterTemplateEditorClient({
  orgId,
  templateId,
  templateName,
  cycleWeeks: initialCycleWeeks,
  entries,
  members,
  canManage,
  orgOpenTimeMin,
  orgCloseTimeMin,
}: RosterTemplateEditorClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cycleWeeks, setCycleWeeks] = useState(initialCycleWeeks);
  const [visibleCount, setVisibleCount] = useState(initialCycleWeeks);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const count = Math.max(
        1,
        Math.floor((width - ROSTER_DAY_LABEL_WIDTH) / MIN_CELL_WIDTH),
      );
      setVisibleCount(count);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const maxOffset = Math.max(0, cycleWeeks - visibleCount);
  const clampedOffset = Math.min(weekOffset, maxOffset);

  const shown = Math.min(visibleCount, cycleWeeks);
  const weekIndices = Array.from(
    { length: shown },
    (_, i) => i + clampedOffset,
  );
  const canGoPrev = clampedOffset > 0;
  const canGoNext = clampedOffset < maxOffset;

  return (
    <>
      <RegisterPageSidebar
        title={templateName}
        content={
          <RosterTemplateEditorSidebar
            orgId={orgId}
            templateId={templateId}
            templateName={templateName}
            cycleWeeks={cycleWeeks}
            entries={entries}
            onCycleWeeksChange={setCycleWeeks}
            canManage={canManage}
          />
        }
      />

      <RegisterPageToolbar>
        {maxOffset > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => setWeekOffset(Math.max(0, clampedOffset - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              Week {clampedOffset + 1}–{clampedOffset + shown}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() =>
                setWeekOffset(Math.min(maxOffset, clampedOffset + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
        <span className="text-sm font-medium">{templateName}</span>
        <span className="text-xs text-muted-foreground">
          {cycleWeeks === 1 ? "1-week cycle" : `${cycleWeeks}-week cycle`}
        </span>
      </RegisterPageToolbar>

      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <RosterTemplateBoard
            orgId={orgId}
            templateId={templateId}
            entries={entries}
            members={members}
            weekIndices={weekIndices}
            orgOpenTimeMin={orgOpenTimeMin}
            orgCloseTimeMin={orgCloseTimeMin}
          />
        </div>
      </div>
    </>
  );
}
