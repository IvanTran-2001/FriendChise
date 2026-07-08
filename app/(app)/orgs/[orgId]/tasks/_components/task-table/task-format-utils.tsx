import type { Task } from "./task-types";

export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ownershipBadge(task: Task, orgId: string) {
  if (task._available) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        Available
      </span>
    );
  }

  if (task.orgId !== orgId) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
        Franchise
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
      Mine
    </span>
  );
}

export function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[•\-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n/g, " ")
    .trim();
}