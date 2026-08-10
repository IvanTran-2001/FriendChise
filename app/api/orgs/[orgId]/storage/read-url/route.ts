import { NextResponse } from "next/server";
import { getOrgStorageReadUrl } from "@/app/actions/storage";
import { getStringField, parseRequestBody } from "@/lib/http/request-body";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const storagePath = getStringField(body, "storagePath");
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  const result = await getOrgStorageReadUrl(orgId, storagePath);
  if (!result.ok) {
    const status = result.error === "Unauthorized"
      ? 403
      : result.error === "Failed to generate signed URL"
        ? 500
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
