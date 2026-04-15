"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  markInvitesSeen,
  acceptMemberInvite,
  declineMemberInvite,
  declineFranchiseInvite,
} from "@/lib/services/invites";

export async function markInvitesSeenAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await markInvitesSeen(session.user.id);
}

export async function acceptMemberInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

  const result = await acceptMemberInvite(inviteId, session.user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}

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
