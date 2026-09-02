import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { getPendingJoinInviteCount } from "@/lib/services/invites";

export async function GET() {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const count = await getPendingJoinInviteCount(user.id);

  return NextResponse.json({ count });
}