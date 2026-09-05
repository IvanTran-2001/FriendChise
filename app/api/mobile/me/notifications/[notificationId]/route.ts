import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { markNotificationSeen } from "@/lib/services/invites";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { notificationId } = await params;

  await markNotificationSeen(notificationId, user.id);

  return NextResponse.json({ ok: true });
}