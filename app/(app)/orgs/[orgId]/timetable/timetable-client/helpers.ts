import { addDays, getMonthName } from "../_shared/grid-utils";
import type { ClientTimetableInstance } from "./types";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<ClientTimetableInstance["status"], string> =
  {
    TODO: "TODO",
    IN_PROGRESS: "IN PROG",
    DONE: "DONE",
    SKIPPED: "SKIP",
  };

export function statusDotClass(status: string): string {
  switch (status) {
    case "TODO":
      return "bg-slate-400";
    case "IN_PROGRESS":
      return "bg-amber-400";
    case "DONE":
      return "bg-green-500";
    case "SKIPPED":
      return "bg-red-400";
    default:
      return "bg-slate-400";
  }
}

export function statusRowClass(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-l-2 border-l-amber-400";
    case "DONE":
      return "border-l-2 border-l-green-500";
    case "SKIPPED":
      return "border-l-2 border-l-red-400";
    default:
      return "border-l-2 border-l-transparent";
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns the Monday (YYYY-MM-DD) of the week containing dateStr. */
export function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

/** Formats a date range label, e.g. "Apr 14–16, 2026" or "Apr 30 – May 2, 2026". */
export function formatDayRange(first: string, last: string): string {
  const fd = new Date(first + "T00:00:00Z");
  const ld = new Date(last + "T00:00:00Z");
  const fm = getMonthName(fd.getUTCMonth());
  const lm = getMonthName(ld.getUTCMonth());
  if (fd.getUTCMonth() === ld.getUTCMonth()) {
    return `${fm} ${fd.getUTCDate()}\u2013${ld.getUTCDate()}, ${fd.getUTCFullYear()}`;
  }
  return `${fm} ${fd.getUTCDate()} \u2013 ${lm} ${ld.getUTCDate()}, ${fd.getUTCFullYear()}`;
}
