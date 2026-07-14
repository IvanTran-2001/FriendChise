import { NextResponse } from "next/server";
import { requireSuperAdminAction } from "@/lib/authz";
import { getFeedbackPage, type FeedbackFilter } from "@/lib/services/feedback";

export async function GET(req: Request) {
  const authz = await requireSuperAdminAction();
  if (!authz.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10), 50);
  const filter = searchParams.get("filter") === "all" ? "all" : "unreviewed";

  const result = await getFeedbackPage(page, pageSize, filter as FeedbackFilter);

  return NextResponse.json({
    feedback: result.feedback,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
    filter: result.filter,
  });
}