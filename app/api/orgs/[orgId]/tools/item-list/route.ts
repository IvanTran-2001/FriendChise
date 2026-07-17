/**
 * GET /api/orgs/[orgId]/tools/item-list
 *
 * Paginated tool-item list for the item list tool.
 *
 * Query params:
 *   page     - 1-based page number (default: 1)
 *   limit    - page size (default: 24, max: 100)
 *   search   - optional name/unit filter
 */

// Serves a page-sized slice of tool items with signed image URLs so the client
// can render the item list without loading the full dataset.
import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { createSignedReadUrls } from "@/lib/platform/supabase-storage";
import { getToolItemsPage } from "@/lib/services/tools";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(Math.max(1, Number.parseInt(searchParams.get("limit") ?? "24", 10) || 24), 100);
  const search = searchParams.get("search") ?? "";

  const pageData = await getToolItemsPage(orgId, { page, pageSize: limit, search });
  const paths = pageData.items.flatMap((item) => (item.imgUrl ? [item.imgUrl] : []));
  const signedUrls = await createSignedReadUrls(paths);

  const items = pageData.items.map((item) => ({
    ...item,
    imageSignedUrl: item.imgUrl ? (signedUrls.get(item.imgUrl) ?? null) : null,
  }));

  return NextResponse.json({
    items,
    totalCount: pageData.totalCount,
    totalPages: pageData.totalPages,
    page: pageData.page,
    pageSize: pageData.pageSize,
    search: pageData.search,
  });
}