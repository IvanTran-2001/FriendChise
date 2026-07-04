"use client";

import Link from "next/link";
import { Bell, Check, History, Megaphone } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AnnouncementScope } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { markAnnouncementSeenAction } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";
import { InviteCard } from "./invite-card";
import { NotificationCard } from "./notification-card";
import type { NotificationFeedItem } from "@/lib/services/notification-feed";

export function NotificationList({
  allItems,
  unseenItems,
  unseenCount,
  onAction,
  onSeen,
}: {
  allItems: NotificationFeedItem[];
  unseenItems: NotificationFeedItem[];
  unseenCount: number;
  onAction: () => void;
  onSeen: () => void;
}) {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const preview = showUnreadOnly ? unseenItems : allItems;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">Notifications</h2>
            <p className="mt-1 text-[11px]">
              {unseenCount > 0 ? (
                <span className="font-medium text-primary">{unseenCount} unseen</span>
              ) : (
                <span className="text-muted-foreground">All caught up</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setShowUnreadOnly(false)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              !showUnreadOnly
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setShowUnreadOnly(true)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              showUnreadOnly
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Unseen
          </button>
        </div>
      </div>

      <div className="flex-1 divide-y divide-border/60 overflow-y-auto">
        {preview.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 py-12 text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="size-5 opacity-40" />
            </div>
            <p className="text-sm font-medium">
              {showUnreadOnly ? "No unseen notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          preview.map((item) => {
            if (item.kind === "invite") {
              return (
                <InviteCard key={item.id} invite={item.invite} onAction={onAction} />
              );
            }

            if (item.kind === "announcement") {
              return (
                <AnnouncementRow
                  key={item.id}
                  announcement={item.announcement}
                  onSeen={onSeen}
                />
              );
            }

            return (
              <NotificationCard
                key={item.id}
                notification={item.notification}
                onSeen={onSeen}
              />
            );
          })
        )}
      </div>

    </div>
  );
}

function AnnouncementRow({
  announcement,
  onSeen,
}: {
  announcement: Extract<NotificationFeedItem, { kind: "announcement" }>["announcement"];
  onSeen: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isSeen = announcement.seenAt !== null;

  function handleSeen() {
    if (isSeen || isPending) {
      onSeen();
      return;
    }

    startTransition(async () => {
      const result = await markAnnouncementSeenAction(announcement.id);
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
      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-border">
        <Megaphone className="size-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Announcement
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                  announcement.scope === AnnouncementScope.GLOBAL
                    ? "border-primary/20 bg-primary/5 text-primary"
                    : "border-border/70 bg-background text-muted-foreground",
                )}
              >
                {announcement.scope === AnnouncementScope.GLOBAL ? "Franchise" : "Org"}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug truncate">
              {announcement.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {announcement.orgName}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">
            {formatRelativeTime(announcement.createdAt)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {announcement.description}
          </p>
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
