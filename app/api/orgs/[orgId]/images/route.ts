import { NextResponse } from "next/server";
import { getOrgImagesPageWithSignedUrls, saveOrgImageToLibrary } from "@/app/actions/storage";
import { MAX_PAGE_SIZE } from "@/lib/services/images";
import { parseRequestBody } from "@/lib/http/request-body";

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function extractPayload(body: Record<string, unknown>) {
  return {
    storagePath: asString(body.storagePath),
    name: asString(body.name),
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
    const status = result.error === "Unauthorized" ? 403 : 400;
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
    const status = result.error === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
