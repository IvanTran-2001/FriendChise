"use client";

import { Building2, Users, Bot } from "lucide-react";
import { toast } from "sonner";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  acceptMemberInviteAction,
  declineMemberInviteAction,
  acceptBotSlotInviteAction,
  declineBotSlotInviteAction,
  declineFranchiseInviteAction,
} from "@/app/actions/invites";
import type { InviteItem } from "@/lib/services/invites";

// ── Subtype derivation ─────────────────────────────────────────────────────

export type InviteSubtype = "MEMBER" | "FRANCHISE" | "BOT_SLOT";

export function getInviteSubtype(invite: InviteItem): InviteSubtype {
  if (invite.type === "FRANCHISE") return "FRANCHISE";
  const meta = invite.metadata as { botMembershipId?: string } | null;
  if (meta?.botMembershipId) return "BOT_SLOT";
  return "MEMBER";
}

// ── Config shape ───────────────────────────────────────────────────────────

export type InviteHandlerResult = { ok: true } | { ok: false; error: string };

export type InviteConfig = {
  /** Short label shown in the badge */
  label: string;
  /** Tailwind classes for the type badge */
  badgeClassName: string;
  /** Icon component to render in the badge */
  Icon: React.ElementType;
  /**
   * Called when the user clicks Accept.
   * The router is provided so franchise invites can navigate.
   */
  onAccept: (
    invite: InviteItem,
    router: AppRouterInstance,
  ) => Promise<InviteHandlerResult | "navigated">;
  /** Called when the user clicks Decline. */
  onDecline: (invite: InviteItem) => Promise<InviteHandlerResult>;
  /** Toast message shown on successful accept */
  acceptToast: (invite: InviteItem) => string;
};

// ── Per-subtype configs ────────────────────────────────────────────────────

const memberConfig: InviteConfig = {
  label: "Member",
  badgeClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Icon: Users,
  onAccept: async (invite) => acceptMemberInviteAction(invite.id),
  onDecline: async (invite) => declineMemberInviteAction(invite.id),
  acceptToast: (invite) => `Joined ${invite.orgName}`,
};

const franchiseConfig: InviteConfig = {
  label: "Franchisee",
  badgeClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Icon: Building2,
  onAccept: async (invite, router) => {
    const token = (invite.metadata as { token?: string } | null)?.token ?? "";
    if (!token || typeof token !== "string") {
      toast.error("Invalid invite token");
      return { ok: false, error: "Invalid invite token" };
    }
    router.push(`/orgs/new?token=${token}`);
    return "navigated";
  },
  onDecline: async (invite) => declineFranchiseInviteAction(invite.id),
  acceptToast: (invite) => `Joining ${invite.orgName}…`,
};

const botSlotConfig: InviteConfig = {
  label: "Fill Bot Slot",
  badgeClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Icon: Bot,
  onAccept: async (invite) => acceptBotSlotInviteAction(invite.id),
  onDecline: async (invite) => declineBotSlotInviteAction(invite.id),
  acceptToast: (invite) => `You've filled the bot slot at ${invite.orgName}`,
};

// ── Lookup ─────────────────────────────────────────────────────────────────

export const INVITE_CONFIGS: Record<InviteSubtype, InviteConfig> = {
  MEMBER: memberConfig,
  FRANCHISE: franchiseConfig,
  BOT_SLOT: botSlotConfig,
};

export function getInviteConfig(invite: InviteItem): InviteConfig {
  return INVITE_CONFIGS[getInviteSubtype(invite)];
}
