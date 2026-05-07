"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Network, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptMemberInviteAction,
  declineMemberInviteAction,
  declineFranchiseInviteAction,
} from "@/app/actions/invites";
import type { InviteItem } from "@/lib/services/invites";

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function InviteHubCard({
  invite,
  onDismiss,
}: {
  invite: InviteItem;
  onDismiss: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isFranchise = invite.type === "FRANCHISE";

  function handleAccept() {
    startTransition(async () => {
      if (isFranchise) {
        const token =
          (invite.metadata as { token?: string } | null)?.token ?? "";
        if (!token) {
          toast.error("Invalid franchise invite token");
          return;
        }
        router.push(`/orgs/new?token=${encodeURIComponent(token)}`);
        return;
      }
      const result = await acceptMemberInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Joined ${invite.orgName}`);
      onDismiss(invite.id);
      router.refresh();
    });
  }

  function handleDecline() {
    startTransition(async () => {
      const result = isFranchise
        ? await declineFranchiseInviteAction(invite.id)
        : await declineMemberInviteAction(invite.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDismiss(invite.id);
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          isFranchise
            ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
            : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        )}
      >
        {isFranchise ? (
          <Network className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{invite.orgName}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              isFranchise
                ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            )}
          >
            {isFranchise ? "Franchisee" : "Member"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {invite.inviterName ? `Invited by ${invite.inviterName}` : "Invited"}{" "}
          · {formatRelative(invite.createdAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={handleDecline}
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </Button>
        <Button
          size="sm"
          disabled={isPending}
          onClick={handleAccept}
        >
          <Check className="h-3.5 w-3.5" />
          {isFranchise ? "Join Franchise" : "Accept"}
        </Button>
      </div>
    </div>
  );
}

export function HubInviteSection({ invites }: { invites: InviteItem[] }) {
  const [visible, setVisible] = useState(invites.map((i) => i.id));

  const shown = invites.filter((i) => visible.includes(i.id));
  if (shown.length === 0) return null;

  function dismiss(id: string) {
    setVisible((prev) => prev.filter((v) => v !== id));
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold">Pending Invitations</h2>
        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary w-5 h-5 text-xs font-semibold">
          {shown.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((invite) => (
          <InviteHubCard key={invite.id} invite={invite} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );
}
