import { NextResponse } from "next/server";
import { getSignedOrgImageUploadUrl } from "@/lib/services/images";

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function extractMimeType(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    return asString(body.get("mimeType"));
  }

  return asString(body.mimeType);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await req.json().catch(() => null)) as Record<string, unknown> | null) ?? {}
    : await req.formData();

  const mimeType = extractMimeType(body);
  if (!mimeType) {
    return NextResponse.json({ error: "mimeType is required." }, { status: 400 });
  }

  const result = await getSignedOrgImageUploadUrl(orgId, mimeType);
  if (!result.ok) {
    const status = result.error === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
