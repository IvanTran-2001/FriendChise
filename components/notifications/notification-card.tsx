"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/services/invites";

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationCard({
  notification,
}: {
  notification: NotificationItem;
}) {
  return (
    <div
      className={cn(
        "relative flex gap-3 px-4 py-3.5 transition-colors",
        !notification.seenAt && "bg-primary/3",
      )}
    >
      {!notification.seenAt && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
      <div className="shrink-0 h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-1 ring-border">
        <Check className="size-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm leading-snug">{notification.message}</p>
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
    </div>
  );
}
