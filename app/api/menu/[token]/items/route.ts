import { NextResponse } from "next/server";
import { getMenuItemsPage, getPublicMenuDetail } from "@/lib/services/tools";
import { createSignedReadUrls, getPublicUrl } from "@/lib/supabase-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const menu = await getPublicMenuDetail(token);
  if (!menu) {
    return NextResponse.json({ error: "Menu not found." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24), 100);
  const search = searchParams.get("search") ?? "";

  const pageData = await getMenuItemsPage(menu.id, { page, pageSize, search });
  const privatePaths = new Set<string>();
  for (const item of pageData.items) {
    const imagePath = item.imageUrl ?? item.toolItem.imgUrl;
    if (imagePath && !imagePath.startsWith(`orgs/${menu.orgId}/images/`)) {
      privatePaths.add(imagePath);
    }
  }

  const signedUrls = await createSignedReadUrls([...privatePaths]);
  const items = pageData.items.map((item) => {
    const imagePath = item.imageUrl ?? item.toolItem.imgUrl;
    const imageUrl = imagePath
      ? imagePath.startsWith(`orgs/${menu.orgId}/images/`)
        ? getPublicUrl(imagePath)
        : signedUrls.get(imagePath) ?? null
      : null;

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      calories: item.calories,
      notes: item.notes,
      imageUrl,
      unit: item.toolItem.unit,
    };
  });

  return NextResponse.json({
    items,
    totalCount: pageData.totalCount,
    totalPages: pageData.totalPages,
    page: pageData.page,
    pageSize: pageData.pageSize,
    hasMore: pageData.page < pageData.totalPages,
  });
}