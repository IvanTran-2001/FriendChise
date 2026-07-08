import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getMembershipsPage } from "@/lib/services/memberships";

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
  const search = searchParams.get("search") ?? undefined;
  const excludeIds = searchParams.getAll("excludeIds").filter(Boolean);
  const excludeBots = searchParams.get("excludeBots") === "true";

  const result = await getMembershipsPage(orgId, {
    page,
    pageSize,
    search,
    excludeIds,
    excludeBots,
  });

  return NextResponse.json({
    memberships: result.memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      name: membership.user?.name ?? membership.botName ?? "Unknown",
      description: membership.user?.email ?? (membership.botName ? "Bot" : undefined),
    })),
    hasMore: result.page < result.totalPages,
  });
}
