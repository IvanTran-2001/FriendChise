import { NextResponse } from "next/server";
import { getSignedOrgImageUploadUrl } from "@/lib/services/images";
import { getStringField, parseRequestBody } from "@/lib/http/request-body";
import { storageErrorStatus } from "@/lib/http/storage-error";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const mimeType = getStringField(body, "mimeType");
  if (!mimeType) {
    return NextResponse.json({ error: "mimeType is required." }, { status: 400 });
  }

  const result = await getSignedOrgImageUploadUrl(orgId, mimeType);
  if (!result.ok) {
    const status = storageErrorStatus(result.code);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
