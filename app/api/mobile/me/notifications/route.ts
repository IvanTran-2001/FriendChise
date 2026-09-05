import { NextResponse } from "next/server";
import {
  getNotificationFeedForUser,
  getNotificationUnseenCountForUser,
} from "@/lib/services/notification-feed";
import { getAuthUser } from "@/lib/authz/_shared";
import { markNotificationsSeen } from "@/lib/services/invites";

export async function GET(req: Request) {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json(
      {
        items: [],
        totalCount: 0,
        totalPages: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);

  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );

  const pageSize = Math.min(
    Math.max(
      1,
      Number.parseInt(
        searchParams.get("pageSize") ?? searchParams.get("limit") ?? "20",
        10,
      ) || 20,
    ),
    50,
  );

  const view = searchParams.get("view") === "unseen" ? "unseen" : "all";

  const [result, unseenCount] = await Promise.all([
    getNotificationFeedForUser(user.id, page, pageSize, { view }),
    getNotificationUnseenCountForUser(user.id),
  ]);

  return NextResponse.json({
    items: result.items,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.page < result.totalPages,
    unseenCount,
  });
}

export async function POST() {
  const user = await getAuthUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  await markNotificationsSeen(user.id);

  return NextResponse.json({ ok: true });
}