import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { joinFranchise } from "@/lib/services/orgs";
import { acceptBotSlotInvite, acceptMemberInvite } from "@/lib/services/invites";
import { prisma } from "@/lib/platform/prisma";
import { getInviteSubtype } from "../../_shared";

type RouteContext = { params: Promise<{ inviteId: string }> };

function mapAcceptError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Failed to accept invite" };
  }

  switch (error.message) {
    case "Invite not found":
      return { status: 404, message: "Invite not found" };
    case "This invite has expired":
    case "This invite is no longer pending":
      return { status: 400, message: error.message };
    case "This invite has already been handled":
    case "Membership conflict":
    case "Membership or role conflict":
    case "The bot slot was already filled by another user":
      return { status: 409, message: error.message };
    case "Invalid token":
    case "Token has already been used":
    case "Token has expired":
    case "This token was not issued to your account":
      return { status: 400, message: error.message };
    default:
      return { status: 500, message: "Failed to accept invite" };
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
    select: { id: true, recipientId: true, type: true, metadata: true, orgId: true },
  });

  if (!invite || invite.recipientId !== user.id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const subtype = getInviteSubtype(invite);

  try {
    if (subtype === "FRANCHISE") {
      const meta = invite.metadata as { token?: string } | null;
      if (!meta?.token) {
        return NextResponse.json({ error: "Invalid invite token" }, { status: 400 });
      }

      const result = await joinFranchise(user.id, user.email ?? "", { token: meta.token });
      return NextResponse.json({
        ok: true,
        organization: {
          id: result.org.id,
          name: result.org.name,
          image: result.org.image ? result.org.image : null,
        },
      });
    }

    const result =
      subtype === "BOT_SLOT"
        ? await acceptBotSlotInvite(invite.id, user.id, user.email)
        : await acceptMemberInvite(invite.id, user.id, user.email);

    if (!result.ok) {
      const mapped = mapAcceptError(result.error as unknown);
      return NextResponse.json({ error: result.error }, { status: mapped.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapAcceptError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
