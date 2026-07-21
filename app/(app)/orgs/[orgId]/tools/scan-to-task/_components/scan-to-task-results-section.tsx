"use client";

import Link from "next/link";
import { ArrowRight, FileScan, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/core/utils";
import type { ScanToTaskResultItem } from "@/app/actions/tools/scan-to-task";

export type DraftScanResultItem = ScanToTaskResultItem & { clientId: string };

type ScanToTaskResultsSectionProps = {
  results: DraftScanResultItem[];
  view: "feed" | "list";
  emptySelectedLabel: string;
  selectedResultId: string | null;
  confirmedTasksById: Record<string, { taskId: string; taskHref: string }>;
  onSelectResult: (resultId: string) => void;
};

function isReadyResult(result: DraftScanResultItem): result is Extract<DraftScanResultItem, { ok: true }> {
  return result.ok;
}

function resultKey(result: DraftScanResultItem) {
  return result.clientId;
}

export function ScanToTaskResultsSection({
  results,
  view,
  emptySelectedLabel,
  selectedResultId,
  confirmedTasksById,
  onSelectResult,
}: ScanToTaskResultsSectionProps) {
  const readyResults = results.filter(isReadyResult);
  const confirmedResults = results.filter((result) => result.ok && confirmedTasksById[result.clientId]);
  const totalConfirmed = confirmedResults.length;
  const totalReady = readyResults.length - totalConfirmed;
  const totalFailed = results.length - readyResults.length;

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Results</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {totalReady > 0 || totalConfirmed > 0 || totalFailed > 0
              ? `${totalReady} ready${totalConfirmed > 0 ? `, ${totalConfirmed} confirmed` : ""}${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`
              : emptySelectedLabel}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {results.length > 0 ? `${results.length} file${results.length === 1 ? "" : "s"}` : "No scans yet"}
        </div>
      </div>

      <div className="mt-4">
        {results.length === 0 ? (
          <EmptyState
            icon={FileScan}
            title="No scans yet"
            description="Upload documents, pictures, or PDFs to create tasks from them."
          />
        ) : view === "list" ? (
          <div className="flex flex-col divide-y overflow-hidden rounded-2xl border border-border/70">
            {results.map((result) => (
              <ScanResultListRow
                key={result.clientId}
                result={result}
                selected={selectedResultId === resultKey(result)}
                confirmedTaskHref={result.ok ? confirmedTasksById[result.clientId]?.taskHref ?? null : null}
                onSelect={() => onSelectResult(resultKey(result))}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {results.map((result) => (
              <ScanResultFeedCard
                key={result.clientId}
                result={result}
                selected={selectedResultId === resultKey(result)}
                confirmedTaskHref={result.ok ? confirmedTasksById[result.clientId]?.taskHref ?? null : null}
                onSelect={() => onSelectResult(resultKey(result))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ScanResultListRow({
  result,
  selected,
  confirmedTaskHref,
  onSelect,
}: {
  result: DraftScanResultItem;
  selected: boolean;
  confirmedTaskHref?: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 bg-card px-3 py-3 text-left transition-colors hover:bg-muted/40",
        selected && "bg-cyan-500/5",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
          result.ok
            ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
            : "border-destructive/20 bg-destructive/10 text-destructive",
        )}
      >
        <FileScan className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{result.fileName}</span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {result.ok ? (confirmedTaskHref ? "Confirmed" : "Ready") : "Failed"}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{result.ok ? result.draft.title : result.error}</p>
      </div>

      {result.ok ? (
        confirmedTaskHref ? (
          <Link href={confirmedTaskHref} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" onClick={(event) => event.stopPropagation()}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">Review</span>
        )
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">View issue</span>
      )}
    </button>
  );
}

function ScanResultFeedCard({
  result,
  selected,
  confirmedTaskHref,
  onSelect,
}: {
  result: DraftScanResultItem;
  selected: boolean;
  confirmedTaskHref?: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-3 rounded-3xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
        selected && "border-cyan-500/40 shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {result.ok ? (confirmedTaskHref ? "Confirmed task" : "Ready to confirm") : "Scan failed"}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">
            {result.ok ? result.draft.title : result.fileName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{result.fileName}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            result.ok
              ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
              : "border-destructive/20 bg-destructive/10 text-destructive",
          )}
        >
          <FileScan className="h-5 w-5" />
        </div>
      </div>

      <p className="text-sm leading-6 text-foreground/90">{result.ok ? result.draft.summary : result.error}</p>

      {result.ok ? (
        <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {result.draft.durationMin} min · {result.draft.peopleRequired} person{result.draft.peopleRequired === 1 ? "" : "s"}
          </span>
          {confirmedTaskHref ? (
            <Link
              href={confirmedTaskHref}
              className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
              onClick={(event) => event.stopPropagation()}
            >
              Open task
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Review in inspector
            </span>
          )}
        </div>
      ) : null}
    </button>
  );
}