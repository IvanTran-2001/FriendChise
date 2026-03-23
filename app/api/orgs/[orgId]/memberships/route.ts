/**
 * REST endpoint: /api/orgs/[orgId]/memberships
 *
 * GET    — List all memberships for the org. Requires ORG_MANAGE permission.
 * POST   — Add a user to the org with a specified role. Requires ORG_MANAGE.
 * DELETE — Remove a user from the org. Requires ORG_MANAGE.
 *           The org owner cannot be removed.
 */
import { NextResponse } from "next/server";
import {
  createMembership,
  deleteMembership,
  getMemberships,
} from "@/lib/services/memberships";
import { requireOrgPermission } from "@/lib/authz";
import { OrgPermission } from "@prisma/client";
import { deleteMembershipSchema } from "@/lib/validators/membership";
import { createMembershipSchema } from "@/lib/validators/membership";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMembershipSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createMembership(orgId, parsed.data);
  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result.data, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = deleteMembershipSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await deleteMembership(orgId, parsed.data.userId);
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, OrgPermission.ORG_MANAGE);
  if (!authz.ok) return authz.response;

  const memberships = await getMemberships(orgId);
  return NextResponse.json(memberships);
}
