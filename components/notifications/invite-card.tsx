"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInviteConfig, getInviteSubtype } from "./invite-config";
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

export function InviteCard({
  invite,
  onAction,
}: {
  invite: InviteItem;
  onAction: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isHandled = invite.status !== "PENDING";
  const config = getInviteConfig(invite);
  const subtype = getInviteSubtype(invite);

  const initials = (invite.inviterName ?? "?")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleAccept() {
    startTransition(async () => {
      const result = await config.onAccept(invite, router);
      if (result === "navigated") return; // franchise: already navigating
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(config.acceptToast(invite));
      onAction();
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const result = await config.onDecline(invite);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onAction();
    });
  }

  const { Icon } = config;

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
            {/* Type badge — driven by config */}
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md mb-1",
                config.badgeClassName,
              )}
            >
              <Icon className="size-2.5" />
              {config.label}
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
        ) : (
          <div className="flex items-center gap-1.5 pt-0.5">
            {/* Franchise uses "Join" label; all others use "Accept" with check icon */}
            {subtype === "FRANCHISE" ? (
              <Button
                size="xs"
                onClick={handleAccept}
                disabled={isPending}
                className="gap-1"
              >
                Join
              </Button>
            ) : (
              <Button
                size="xs"
                onClick={handleAccept}
                disabled={isPending}
                className="gap-1"
              >
                <Check className="size-3" /> Accept
              </Button>
            )}
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
