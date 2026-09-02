import { NextResponse } from "next/server";
import { getAuthUserId, getOrgMembership } from "@/lib/authz/_shared";
import { getRolesPage } from "@/lib/services/roles";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(req: Request, { params }: RouteContext) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ roles: [] }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await getOrgMembership(orgId, userId);
  if (!membership) {
    return NextResponse.json({ roles: [] }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? searchParams.get("limit") ?? "20", 10) || 20),
    50,
  );
  const search = searchParams.get("search") ?? undefined;

  const result = await getRolesPage(orgId, { page, pageSize, search });

  return NextResponse.json({
    roles: result.roles,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.page < result.totalPages,
  });
}
