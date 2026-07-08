import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getMembershipsPage } from "@/lib/services/memberships";

// Memberships are served as a paged API because the members page and multiple
// pickers now load the org roster incrementally instead of receiving it all at
// once from the server component.

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

  // Keep the payload picker-friendly: the list view still gets memberRoles,
  // while the combobox surfaces just name, description, and the user snapshot.
  return NextResponse.json({
    memberships: result.memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      status: membership.status,
      joinedAt: membership.joinedAt,
      workingDays: membership.workingDays,
      user: membership.user
        ? {
            id: membership.user.id,
            name: membership.user.name,
            email: membership.user.email,
            image: membership.user.image,
          }
        : null,
      memberRoles: membership.memberRoles.map((memberRole) => ({
        role: {
          id: memberRole.role.id,
          name: memberRole.role.name,
          color: memberRole.role.color,
        },
      })),
      name: membership.user?.name ?? membership.botName ?? "Unknown",
      description: membership.user?.email ?? (membership.botName ? "Bot" : undefined),
    })),
    hasMore: result.page < result.totalPages,
  });
}
