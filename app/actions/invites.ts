"use server";

/**
 * Server actions for the notification / invite system.
 *
 * markInvitesSeenAction        — mark all unseen invites as seen so the bell badge clears.
 * acceptMemberInviteAction     — accept a pending member invite; creates the Membership + MemberRole.
 * declineMemberInviteAction    — decline a pending member invite.
 * acceptBotSlotInviteAction    — accept a bot-slot invite; slots the user into the bot membership row.
 * declineBotSlotInviteAction   — decline a bot-slot invite.
 * declineFranchiseInviteAction — decline a pending franchise invite; also expires the token.
 *
 * All actions read the session directly. They delegate to `lib/services/invites`
 * for DB writes and call `revalidatePath` so the navbar badge refreshes.
 */

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  markInvitesSeen,
  markNotificationsSeen,
  acceptMemberInvite,
  declineMemberInvite,
  acceptBotSlotInvite,
  declineBotSlotInvite,
  declineFranchiseInvite,
} from "@/lib/services/invites";

/** Marks all unseen invites and notifications for the current user as seen. */
export async function markInvitesSeenAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await Promise.all([
    markInvitesSeen(session.user.id),
    markNotificationsSeen(session.user.id),
  ]);
}

/**
 * Accepts a pending member invite.
 * Creates the Membership + MemberRole rows atomically. On success, revalidates
 * the root layout so the sidebar org list and navbar update immediately.
 */
export async function acceptMemberInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await acceptMemberInvite(
    inviteId,
    session.user.id,
    session.user.email,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}

/** Declines a pending member invite, setting its status to DECLINED. */
export async function declineMemberInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await declineMemberInvite(inviteId, session.user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}

/**
 * Accepts a pending bot-slot invite.
 * Slots the user into the existing bot membership row (userId = user, botName = null).
 */
export async function acceptBotSlotInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await acceptBotSlotInvite(
    inviteId,
    session.user.id,
    session.user.email,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}

/** Declines a pending bot-slot invite. */
export async function declineBotSlotInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await declineBotSlotInvite(inviteId, session.user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}

/**
 * Declines a pending franchise invite.
 * Also expires the associated FranchiseToken so it cannot be reused by
 * a different user or via the join URL directly.
 */
export async function declineFranchiseInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await declineFranchiseInvite(inviteId, session.user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}
