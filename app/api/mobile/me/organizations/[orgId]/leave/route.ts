import { NextResponse } from "next/server";
import { getAuthUser, getOrgMembership } from "@/lib/authz/_shared";
import { memberToBot } from "@/lib/services/bots";

type RouteContext = { params: Promise<{ orgId: string }> };

function mapLeaveOrgError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Failed to leave organization" };
  }

  switch (error.message) {
    case "Org not found":
    case "Membership not found":
      return { status: 404, message: "Membership not found" };
    case "Cannot convert the organization owner to a bot":
      return {
        status: 403,
        message: "Organization owners can't leave. Transfer ownership first.",
      };
    case "Membership is already a bot":
      return { status: 400, message: error.message };
    default:
      return { status: 500, message: "Failed to leave organization" };
  }
}

function mapLeaveOrgResult(result: {
  ok: false;
  code?: string;
  error: string;
}) {
  if (result.code === "NOT_FOUND") {
    return { status: 404, message: "Membership not found" };
  }

  if (result.code === "INVALID") {
    if (result.error === "Cannot convert the organization owner to a bot") {
      return {
        status: 403,
        message: "Organization owners can't leave. Transfer ownership first.",
      };
    }

    return { status: 400, message: result.error };
  }

  return { status: 500, message: "Failed to leave organization" };
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await getOrgMembership(orgId, user.id);
  if (!membership) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  try {
    const result = await memberToBot(
      orgId,
      { membershipId: membership.id, overrideName: "placeholder" },
      user.id,
      user.email,
    );
    if (!result.ok) {
      const mapped = mapLeaveOrgResult(result);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mobile/me/organizations/leave] leave organization failed", err);
    const mapped = mapLeaveOrgError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}