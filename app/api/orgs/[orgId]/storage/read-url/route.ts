import { NextResponse } from "next/server";
import { getOrgStorageReadUrl } from "@/app/actions/storage";

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function extractStoragePath(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    return asString(body.get("storagePath"));
  }

  return asString(body.storagePath);
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

  const storagePath = extractStoragePath(body);
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  const result = await getOrgStorageReadUrl(orgId, storagePath);
  if (!result.ok) {
    const status = result.error === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
