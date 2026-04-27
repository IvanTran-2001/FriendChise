"use client";

import { useState } from "react";
import { Bell, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCard } from "./notification-card";
import { InviteCard } from "./invite-card";
import type { InviteItem, NotificationItem } from "@/lib/services/invites";

type AnyItem =
  | { kind: "invite"; data: InviteItem }
  | { kind: "notif"; data: NotificationItem };

export function NotificationList({
  invites,
  notifications,
  onAction,
}: {
  invites: InviteItem[];
  notifications: NotificationItem[];
  onAction: () => void;
}) {
  const [onlyUnread, setOnlyUnread] = useState(false);

  const visibleInvites = onlyUnread
    ? invites.filter((i) => !i.seenAt && i.status === "PENDING")
    : invites;

  const visibleNotifs = onlyUnread
    ? notifications.filter((n) => !n.seenAt)
    : notifications;

  // Merge and sort newest-first so all items appear in chronological order.
  const merged: AnyItem[] = [
    ...visibleInvites.map((i) => ({ kind: "invite" as const, data: i })),
    ...visibleNotifs.map((n) => ({ kind: "notif" as const, data: n })),
  ].sort(
    (a, b) =>
      new Date(b.data.createdAt).getTime() -
      new Date(a.data.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <button
          onClick={() => setOnlyUnread((v) => !v)}
          aria-pressed={onlyUnread}
          className={cn(
            "text-xs px-2 py-1 rounded-md font-medium transition-colors",
            onlyUnread
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Unread only
        </button>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {merged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-muted-foreground">
            <Bell className="size-8 opacity-20" />
            <p className="text-sm">
              {onlyUnread ? "No unread notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          merged.map((item) =>
            item.kind === "notif" ? (
              <NotificationCard
                key={`n-${item.data.id}`}
                notification={item.data}
              />
            ) : (
              <InviteCard
                key={`i-${item.data.id}`}
                invite={item.data}
                onAction={onAction}
              />
            ),
          )
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="size-3" />
          History
        </div>
      </div>
    </div>
  );
}
