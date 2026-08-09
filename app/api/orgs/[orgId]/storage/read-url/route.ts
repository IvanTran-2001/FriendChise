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

async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isForm =
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded");

  if (!isJson && !isForm) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 415 });
  }

  if (isJson) {
    try {
      return ((await req.json()) as Record<string, unknown> | null) ?? {};
    } catch {
      return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
    }
  }

  try {
    return await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed form body." }, { status: 400 });
  }
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

  return NextResponse.json(result, { status: 201 });
}
