"use client";

import Link from "next/link";
import { Bell, Check, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NotificationCard } from "@/components/notifications/notification-card";
import { InviteCard } from "@/components/notifications/invite-card";
import { markAnnouncementSeenAction } from "@/app/actions/notifications";
import { cn } from "@/lib/core/utils";
import { AnnouncementScope } from "@prisma/client";
import type { NotificationFeedItem } from "@/lib/services/notification-feed";

type NotificationClientProps = {
  items: NotificationFeedItem[];
  unseenItemCount: number;
  view: "all" | "unseen";
  page: number;
  totalPages: number;
};

export function NotificationClient({
  items,
  unseenItemCount,
  view,
  page,
  totalPages,
}: NotificationClientProps) {
  const router = useRouter();
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const sortedItems = [...items].sort((left, right) => {
    const leftSeen = isFeedItemSeen(left);
    const rightSeen = isFeedItemSeen(right);

    if (leftSeen !== rightSeen) {
      return leftSeen ? 1 : -1;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-0.5 text-sm">
              {unseenItemCount > 0 ? (
                <span className="font-medium text-primary">{unseenItemCount} unseen</span>
              ) : (
                <span className="text-muted-foreground">All caught up</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5 gap-0.5">
          <Link
            href={buildNotificationsHref(1, "all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              view === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </Link>
          <Link
            href={buildNotificationsHref(1, "unseen")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              view === "unseen"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Unseen
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Bell className="size-6 opacity-40" />
            </div>
            <p className="text-sm font-medium">
              {view === "unseen" ? "No unseen notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {sortedItems.map((item) => {
              if (item.kind === "invite") {
                return (
                  <InviteCard key={item.id} invite={item.invite} onAction={() => router.refresh()} />
                );
              }

              if (item.kind === "announcement") {
                return (
                  <AnnouncementCard
                    key={item.id}
                    announcement={item.announcement}
                    onSeen={() => router.refresh()}
                  />
                );
              }

              return (
                <NotificationCard
                  key={item.id}
                  notification={item.notification}
                  onSeen={() => router.refresh()}
                />
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <Button variant="outline" size="sm" disabled={!hasPreviousPage} asChild={hasPreviousPage}>
            {hasPreviousPage ? (
              <Link href={buildNotificationsHref(page - 1, view)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </span>
            )}
          </Button>

          <span className="text-sm font-medium text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <Button variant="outline" size="sm" disabled={!hasNextPage} asChild={hasNextPage}>
            {hasNextPage ? (
              <Link href={buildNotificationsHref(page + 1, view)}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center">
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function buildNotificationsHref(page: number, view: "all" | "unseen"): string {
  const searchParams = new URLSearchParams();

  if (page > 1) {
    searchParams.set("page", String(page));
  }

  searchParams.set("view", view);

  const query = searchParams.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

function isFeedItemSeen(item: NotificationFeedItem): boolean {
  if (item.kind === "invite") return item.invite.seenAt !== null;
  if (item.kind === "announcement") return item.announcement.seenAt !== null;
  return item.notification.seenAt !== null;
}

function AnnouncementCard({
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