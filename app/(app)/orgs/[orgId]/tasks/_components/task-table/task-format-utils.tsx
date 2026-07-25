import type { Task } from "./task-types";
import { Badge } from "@/components/ui/badge";

export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ownershipBadge(task: Task, orgId: string) {
  if (task._available) {
    return <Badge variant="emerald">Available</Badge>;
  }

  if (task.orgId !== orgId) {
    return <Badge variant="blue">Franchise</Badge>;
  }

  return (
    <Badge variant="neutral" className="border border-border">
      Mine
    </Badge>
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