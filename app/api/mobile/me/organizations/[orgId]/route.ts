import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/authz/_shared";
import { parseRequestBody } from "@/lib/http/request-body";
import { deleteOrg as deleteOrgService } from "@/lib/services/orgs";
import { deleteOrgSchema } from "@/lib/validators/org";

type RouteContext = { params: Promise<{ orgId: string }> };

function mapDeleteOrgError(error: unknown) {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Failed to delete organization" };
  }

  switch (error.message) {
    case "Organization not found":
      return { status: 404, message: "Organization not found" };
    case "Only the owner can delete this org":
    case "Franchisee orgs cannot be deleted this way":
      return { status: 403, message: error.message };
    case "Confirmation name does not match":
      return { status: 400, message: "Confirmation name does not match" };
    default:
      return { status: 500, message: "Failed to delete organization" };
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = deleteOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    await deleteOrgService(orgId, user.id, parsed.data.confirmName, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mobile/me/organizations/delete] delete organization failed", err);
    const mapped = mapDeleteOrgError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}