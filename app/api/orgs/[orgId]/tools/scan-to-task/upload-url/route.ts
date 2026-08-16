import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { getStringField, parseRequestBody } from "@/lib/http/request-body";
import { log } from "@/lib/platform/observability";
import { MAX_FILE_BYTES, buildTempUploadPath } from "@/lib/services/scan-to-task";
import { createSignedUploadUrl } from "@/lib/platform/supabase-storage";
import { getUploadUrlSchema } from "@/lib/validators/scan-to-task";

/**
 * Mobile-facing Scan to Task upload endpoint.
 *
 * Returns a short-lived signed URL the client uploads the file to directly,
 * mirroring `getScanToTaskUploadUrlAction` on the web app.
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

  const parsed = getUploadUrlSchema.safeParse({
    fileName: getStringField(body, "fileName"),
    mimeType: getStringField(body, "mimeType"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid file before uploading." }, { status: 400 });
  }

  const storagePath = buildTempUploadPath(orgId, parsed.data.fileName, parsed.data.mimeType);
  const signed = await createSignedUploadUrl(storagePath, MAX_FILE_BYTES);
  if (!signed.ok) {
    log.error("Failed to create scan-to-task upload URL", {
      orgId,
      storagePath,
      error: signed.error,
    });
    return NextResponse.json({ error: "Failed to prepare upload." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: signed.signedUrl, path: signed.path }, { status: 200 });
}
