import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { markInviteSeen } from "@/lib/services/invites";

type RouteContext = {
  params: Promise<{ inviteId: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { inviteId } = await params;

  await markInviteSeen(inviteId, user.id);

  return NextResponse.json({ ok: true });
}
