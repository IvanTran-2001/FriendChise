import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { getStringField, parseRequestBody } from "@/lib/http/request-body";
import { prisma } from "@/lib/platform/prisma";

/**
 * Mobile-facing Scan to Task clear endpoint.
 *
 * Clears a scan result from the active queue without deleting the row,
 * mirroring `clearScanToTaskResultAction` on the web app.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const resultId = getStringField(body, "resultId")?.trim();
  if (!resultId) {
    return NextResponse.json({ error: "Missing scan result." }, { status: 400 });
  }

  const result = await prisma.scanTaskResult.updateMany({
    where: { id: resultId, orgId },
    data: { clearedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Scan result not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
