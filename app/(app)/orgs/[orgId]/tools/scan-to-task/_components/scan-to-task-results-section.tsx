"use client";

import Link from "next/link";
import { ArrowRight, FileScan, Loader2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import { formatFileSize } from "@/lib/services/scan-to-task-shared";
import type { ScanToTaskResultItem } from "@/app/actions/tools/scan-to-task";
import { SegmentedControl } from "@/components/ui/controls/segmented-control";

export type DraftScanResultItem = ScanToTaskResultItem & { clientId: string };

type ScanToTaskResultsSectionProps = {
  results: DraftScanResultItem[];
  view: "feed" | "list";
  loading: boolean;
  emptySelectedLabel: string;
  selectedResultId: string | null;
  confirmedTasksById: Record<string, { taskId: string; taskHref: string }>;
  onSelectResult: (resultId: string) => void;
  onViewChange: (view: "feed" | "list") => void;
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
  loading,
  emptySelectedLabel,
  selectedResultId,
  confirmedTasksById,
  onSelectResult,
  onViewChange,
}: ScanToTaskResultsSectionProps) {
  const readyResults = results.filter(isReadyResult);
  const confirmedResults = results.filter((result) => result.ok && confirmedTasksById[result.clientId]);
  const totalConfirmed = confirmedResults.length;
  const totalReady = readyResults.length - totalConfirmed;
  const totalFailed = results.length - readyResults.length;

  return (
    <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <FileScan className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Scan queue</h2>
          </div>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
            {totalReady > 0 || totalConfirmed > 0 || totalFailed > 0
              ? `${totalReady} ready${totalConfirmed > 0 ? `, ${totalConfirmed} confirmed` : ""}${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`
              : emptySelectedLabel}
          </p>
        </div>
        <SegmentedControl<"feed" | "list">
          value={view}
          onChange={onViewChange}
          className="w-full sm:w-auto"
          options={[
            { value: "feed", label: "Feed" },
            { value: "list", label: "List" },
          ]}
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">AI is analyzing the files</p>
              <p className="text-xs text-muted-foreground">This usually takes a few seconds while the drafts are generated.</p>
            </div>
          </div>
        ) : null}
        {results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <FileScan className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No scans yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Upload documents, pictures, or PDFs to create tasks from them.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-2">
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
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background p-3 text-left outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
          result.ok
            ? "bg-muted text-muted-foreground ring-border/70"
            : "bg-destructive/10 text-destructive ring-destructive/15",
        )}
      >
        <FileScan className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{result.fileName}</span>
          <Badge variant={result.ok ? (confirmedTaskHref ? "success" : "neutral") : "error"} size="sm">
            {result.ok ? (confirmedTaskHref ? "Confirmed" : "Ready") : "Failed"}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {result.ok ? result.draft.title : result.error} · {formatFileSize(result.fileSize)}
        </p>
      </div>

      {result.ok && confirmedTaskHref ? (
        <Link
          href={confirmedTaskHref}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
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
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={cn(
        "group flex min-h-0 min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-background p-4 text-left outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant={result.ok ? (confirmedTaskHref ? "success" : "neutral") : "error"} size="sm">
            {result.ok ? (confirmedTaskHref ? "Confirmed" : "Ready") : "Failed"}
          </Badge>
          <h3 className="mt-1.5 truncate text-sm font-medium text-foreground">
            {result.ok ? result.draft.title : result.fileName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground wrap-break-word">
            {result.fileName} · {formatFileSize(result.fileSize)}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
            result.ok
              ? "bg-muted text-muted-foreground ring-border/70"
              : "bg-destructive/10 text-destructive ring-destructive/15",
          )}
        >
          <FileScan className="h-4 w-4" />
        </div>
      </div>

      <p className="text-sm leading-6 text-foreground/90 line-clamp-3">{result.ok ? result.draft.summary : result.error}</p>

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
            <span className="inline-flex items-center gap-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              Review
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}