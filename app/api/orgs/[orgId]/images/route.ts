import { NextResponse } from "next/server";
import { MAX_PAGE_SIZE, getOrgImagesPageWithSignedUrls, saveOrgImageToLibrary } from "@/lib/services/images";
import { getStringField, parseRequestBody } from "@/lib/http/request-body";
import { storageErrorStatus } from "@/lib/http/storage-error";

function extractPayload(body: Record<string, unknown> | FormData) {
  return {
    storagePath: getStringField(body, "storagePath"),
    name: getStringField(body, "name"),
  };
}

function extractQueryParams(url: URL) {
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "24");
  const search = url.searchParams.get("search") ?? undefined;

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(MAX_PAGE_SIZE, pageSize) : 24,
    search: search?.trim() || undefined,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const options = extractQueryParams(url);

  const result = await getOrgImagesPageWithSignedUrls(orgId, options);
  if (!result.ok) {
    const status = storageErrorStatus(result.code);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const payload = extractPayload(body);
  if (!payload.storagePath) {
    return NextResponse.json({ error: "storagePath is required." }, { status: 400 });
  }

  const result = await saveOrgImageToLibrary(orgId, payload.storagePath, payload.name);
  if (!result.ok) {
    const status = storageErrorStatus(result.code);
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
