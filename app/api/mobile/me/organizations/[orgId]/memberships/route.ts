import { NextResponse } from "next/server";
import { z } from "zod";
import { PermissionAction } from "@prisma/client";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import { getPublicUrl } from "@/lib/platform/supabase-storage";
import { getMembershipsPage } from "@/lib/services/memberships";
import { createMemberInvite } from "@/lib/services/invites";
import { parseRequestBody } from "@/lib/http/request-body";

const inviteSchema = z.object({
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  roleIds: z.array(z.string().cuid()).default([]),
  workingDays: z.array(
    z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  ),
});

function toMembershipItem(membership: Awaited<ReturnType<typeof getMembershipsPage>>["memberships"][number]) {
  return {
    id: membership.id,
    userId: membership.userId,
    botName: membership.botName,
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
    image: membership.user?.image ? getPublicUrl(membership.user.image) : null,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? searchParams.get("limit") ?? "20", 10) || 20),
    50,
  );
  const search = searchParams.get("search") ?? undefined;
  const roleId = searchParams.get("roleId") ?? undefined;
  const excludeIds = searchParams.getAll("excludeIds").filter(Boolean);
  const excludeBots = searchParams.get("excludeBots") === "true";

  const result = await getMembershipsPage(orgId, {
    page,
    pageSize,
    search,
    roleId,
    excludeIds,
    excludeBots,
  });

  return NextResponse.json({
    memberships: result.memberships.map(toMembershipItem),
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
    hasMore: result.page < result.totalPages,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_MEMBERS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const recipient = await import("@/lib/platform/prisma").then(({ prisma }) =>
    prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
  );
  if (!recipient) {
    return NextResponse.json(
      { error: "No user found with that email address", field: "email" },
      { status: 400 },
    );
  }

  const result = await createMemberInvite(
    orgId,
    authz.userId,
    recipient.id,
    parsed.data.roleIds,
    parsed.data.workingDays,
    { actorEmail: authz.userEmail },
  );

  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : 400;
    const field = result.code === "CONFLICT" ? "email" : result.code === "INVALID" ? "roles" : undefined;
    return NextResponse.json(
      { error: result.error, ...(field ? { field } : {}) },
      { status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}