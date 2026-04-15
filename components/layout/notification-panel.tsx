"use client";

import { useState, useTransition } from "react";
import { Bell, Check, X, Building2, Users, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  markInvitesSeenAction,
  acceptMemberInviteAction,
  declineMemberInviteAction,
  declineFranchiseInviteAction,
} from "@/app/actions/invites";
import type { InviteItem } from "@/lib/services/invites";

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

function InviteCard({
  invite,
  onAction,
}: {
  invite: InviteItem;
  onAction: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isHandled = invite.status !== "PENDING";

  const initials = (invite.inviterName ?? "?")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptMemberInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Joined ${invite.orgName}`);
      onAction();
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const result =
        invite.type === "FRANCHISE"
          ? await declineFranchiseInviteAction(invite.id)
          : await declineMemberInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAction();
    });
  }

  return (
    <div
      className={cn(
        "relative flex gap-3 px-4 py-3.5 transition-colors group",
        isHandled ? "opacity-50" : "hover:bg-muted/40",
        !invite.seenAt && !isHandled && "bg-primary/3",
      )}
    >
      {/* Unread indicator */}
      {!invite.seenAt && !isHandled && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      {/* Avatar */}
      <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground ring-1 ring-border">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Type badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md mb-1",
                invite.type === "FRANCHISE"
                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              )}
            >
              {invite.type === "FRANCHISE" ? (
                <>
                  <Building2 className="size-2.5" /> Franchisee
                </>
              ) : (
                <>
                  <Users className="size-2.5" /> Member
                </>
              )}
            </span>
            <p className="text-sm font-medium leading-snug truncate">
              {invite.orgName}
            </p>
            {invite.inviterName && (
              <p className="text-xs text-muted-foreground truncate">
                Invited by {invite.inviterName}
              </p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">
            {formatRelativeTime(invite.createdAt)}
          </span>
        </div>

        {/* Status / Actions */}
        {isHandled ? (
          <span
            className={cn(
              "text-xs font-medium",
              invite.status === "ACCEPTED"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
            )}
          >
            {invite.status === "ACCEPTED" ? "Accepted" : "Declined"}
          </span>
        ) : invite.type === "FRANCHISE" ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              size="xs"
              onClick={() => {
                const token =
                  (invite.metadata as { token?: string } | null)?.token ?? "";
                if (!token || typeof token !== "string") {
                  toast.error("Invalid invite token");
                  return;
                }
                router.push(`/orgs/new?token=${token}`);
              }}
              disabled={isPending}
              className="gap-1"
            >
              Join
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleDecline}
              disabled={isPending}
              className="gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="size-3" /> Decline
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              size="xs"
              onClick={handleAccept}
              disabled={isPending}
              className="gap-1"
            >
              <Check className="size-3" /> Accept
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleDecline}
              disabled={isPending}
              className="gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="size-3" /> Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationList({
  invites,
  onAction,
}: {
  invites: InviteItem[];
  onAction: () => void;
}) {
  const [onlyUnread, setOnlyUnread] = useState(false);

  const visible = onlyUnread
    ? invites.filter((i) => !i.seenAt && i.status === "PENDING")
    : invites;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <button
          onClick={() => setOnlyUnread((v) => !v)}
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
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-muted-foreground">
            <Bell className="size-8 opacity-20" />
            <p className="text-sm">
              {onlyUnread ? "No unread notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          visible.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onAction={onAction} />
          ))
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

export function NotificationPanel({
  invites,
  unseenCount,
}: {
  invites: InviteItem[];
  unseenCount: number;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (next && unseenCount > 0) {
      await markInvitesSeenAction();
      router.refresh();
    }
  }

  function handleAction() {
    setOpen(false);
    router.refresh();
  }

  const BellButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      <Bell className="h-4 w-4" />
      {unseenCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-0.5 leading-none font-medium">
          {unseenCount > 99 ? "99+" : unseenCount}
        </span>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetTrigger asChild>{BellButton}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[85dvh] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20 mx-auto mt-3 mb-0 shrink-0" />
          <NotificationList invites={invites} onAction={handleAction} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{BellButton}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-95 h-120 p-0 flex flex-col overflow-hidden shadow-xl"
      >
        <NotificationList invites={invites} onAction={handleAction} />
      </PopoverContent>
    </Popover>
  );
}
