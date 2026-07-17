"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markNotificationSeenAction } from "@/app/actions/notifications";
import { cn } from "@/lib/core/utils";
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
  onSeen,
}: {
  notification: NotificationItem;
  onSeen: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isSeen = notification.seenAt !== null;

  function handleSeen() {
    if (isSeen || isPending) {
      onSeen();
      return;
    }

    startTransition(async () => {
      const result = await markNotificationSeenAction(notification.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSeen();
    });
  }

  return (
    <div
      className={cn(
        "relative flex gap-3 px-4 py-3.5 transition-colors",
        !isSeen && "bg-primary/3",
      )}
    >
      <div className="shrink-0 h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-1 ring-border">
        <Check className="size-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm leading-snug">{notification.message}</p>
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            variant={isSeen ? "ghost" : "outline"}
            onClick={handleSeen}
            disabled={isPending}
            aria-label={isSeen ? "Already seen" : "Mark as seen"}
            className={cn("h-7 w-7 shrink-0 rounded-full", isSeen && "text-primary")}
          >
            <Check className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
