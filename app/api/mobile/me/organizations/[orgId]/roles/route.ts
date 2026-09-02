import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getRoles } from "@/lib/services/roles";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) {
    return authz.response;
  }

  const searchParams = new URL(_req.url).searchParams;
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize") ?? searchParams.get("limit");
  const search = searchParams.get("search") ?? undefined;

  if (page || pageSize || search) {
    const result = await getRoles(orgId, {
      page: Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
      pageSize: Math.min(Math.max(1, Number.parseInt(pageSize ?? "20", 10) || 20), 50),
      search,
    });

    return NextResponse.json({
      roles: result.roles,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.page < result.totalPages,
    });
  }

  const roles = await getRoles(orgId);

  return NextResponse.json({ roles });
}
