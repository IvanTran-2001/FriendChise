import { NextResponse } from "next/server";
import { requireSuperAdminAction } from "@/lib/authz";
import { getGlobalOrgImagesPage } from "@/lib/services/images";
import { createSignedReadUrls, getPublicUrl } from "@/lib/platform/supabase-storage";

export type OrgImageTile = {
  key: string;
  label: string;
  sublabel: string;
  src: string;
  href: string;
};

export async function GET(req: Request) {
  const authz = await requireSuperAdminAction();
  if (!authz.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "12", 10) || 12),
    50,
  );
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const result = await getGlobalOrgImagesPage({ page, pageSize });

  // Batch-sign only the URLs for this page — not the whole table.
  const signedUrls = await createSignedReadUrls(
    result.images.map((img) => img.storagePath),
  );

  const items: OrgImageTile[] = result.images.map((img) => ({
    key: img.id,
    label: img.name ?? "Org image",
    sublabel: img.org?.name ?? img.storagePath,
    src: signedUrls.get(img.storagePath) ?? getPublicUrl(img.storagePath),
    href: signedUrls.get(img.storagePath) ?? getPublicUrl(img.storagePath),
  }));

  return NextResponse.json({
    items,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
  });
}
