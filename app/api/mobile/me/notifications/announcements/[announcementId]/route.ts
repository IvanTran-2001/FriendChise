import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz/_shared";
import { markAnnouncementSeen } from "@/lib/services/announcements";

type RouteContext = {
  params: Promise<{ announcementId: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { announcementId } = await params;

  await markAnnouncementSeen(user.id, announcementId);

  return NextResponse.json({ ok: true });
}