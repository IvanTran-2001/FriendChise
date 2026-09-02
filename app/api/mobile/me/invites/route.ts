import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { getPaginatedInvitesForUser } from "@/lib/services/invites";
import { getInviteSubtype } from "./_shared";

function toInviteItem(invite: Awaited<ReturnType<typeof getPaginatedInvitesForUser>>["items"][number]) {
  return {
    id: invite.id,
    type: invite.type,
    subtype: getInviteSubtype(invite),
    status: invite.status,
    orgId: invite.orgId,
    orgName: invite.orgName,
    inviterName: invite.inviterName,
    seenAt: invite.seenAt,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    acceptedAt: invite.acceptedAt,
    declinedAt: invite.declinedAt,
    metadata: invite.metadata,
  };
}

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ invites: [] }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? searchParams.get("limit") ?? "20", 10) || 20),
    50,
  );
  const view = searchParams.get("view") === "unseen" ? "unseen" : "all";
  const search = searchParams.get("search") ?? undefined;

  const result = await getPaginatedInvitesForUser(user.id, page, pageSize, { view, search });

  return NextResponse.json({
    invites: result.items.map(toInviteItem),
    total: result.total,
    totalPages: result.totalPages,
    page,
    pageSize,
    hasMore: page < result.totalPages,
  });
}
