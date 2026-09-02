import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import {
  declineBotSlotInvite,
  declineFranchiseInvite,
  declineMemberInvite,
} from "@/lib/services/invites";
import { prisma } from "@/lib/platform/prisma";
import { getInviteSubtype } from "../../_shared";

type RouteContext = { params: Promise<{ inviteId: string }> };

function mapDeclineError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Failed to decline invite" };
  }

  switch (error.message) {
    case "Invite not found":
    case "Invite not found or already handled":
      return { status: 404, message: error.message };
    case "This invite is no longer pending":
      return { status: 409, message: error.message };
    default:
      return { status: 500, message: "Failed to decline invite" };
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteId } = await params;
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, recipientId: true, type: true, metadata: true },
  });

  if (!invite || invite.recipientId !== user.id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const subtype = getInviteSubtype(invite);

  try {
    const result =
      subtype === "FRANCHISE"
        ? await declineFranchiseInvite(invite.id, user.id)
        : subtype === "BOT_SLOT"
          ? await declineBotSlotInvite(invite.id, user.id)
          : await declineMemberInvite(invite.id, user.id);

    if (!result.ok) {
      const mapped = mapDeclineError(new Error(result.error));
      return NextResponse.json({ error: result.error }, { status: mapped.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapDeclineError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
