import { InviteType } from "@prisma/client";

export type InviteSubtype = "MEMBER" | "FRANCHISE" | "BOT_SLOT";

export function getInviteSubtype(invite: {
  type: InviteType;
  metadata: unknown;
}): InviteSubtype {
  if (invite.type === InviteType.FRANCHISE) return "FRANCHISE";
  const meta = invite.metadata as { botMembershipId?: string } | null;
  if (meta?.botMembershipId) return "BOT_SLOT";
  return "MEMBER";
}
