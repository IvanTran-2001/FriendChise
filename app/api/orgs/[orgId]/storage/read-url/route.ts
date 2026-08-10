import { NextResponse } from "next/server";
import { getOrgStorageReadUrl } from "@/app/actions/storage";
import { parseRequestBody } from "@/lib/http/request-body";

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function extractStoragePath(body: Record<string, unknown> | FormData) {
  return asString(body instanceof FormData ? body.get("storagePath") : body.storagePath);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const storagePath = extractStoragePath(body);
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  const result = await getOrgStorageReadUrl(orgId, storagePath);
  if (!result.ok) {
    const status = result.error === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
