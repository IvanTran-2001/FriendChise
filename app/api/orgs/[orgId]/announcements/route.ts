import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getAnnouncementsPage } from "@/lib/services/announcements";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10), 50);
  const rawOrder = searchParams.get("order");
  const order = rawOrder === "oldest" ? "oldest" : "newest";

  const result = await getAnnouncementsPage(orgId, {
    page,
    pageSize,
    order,
  });

  return NextResponse.json({
    announcements: result.announcements,
    page: result.page,
    totalPages: result.totalPages,
    pageSize: result.pageSize,
    order,
  });
}