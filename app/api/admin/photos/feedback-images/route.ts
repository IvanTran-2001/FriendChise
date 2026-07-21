import { NextResponse } from "next/server";
import { FeedbackType } from "@prisma/client";
import { requireSuperAdminAction } from "@/lib/authz";
import { getFeedbackImagesPage } from "@/lib/services/feedback";
import { createSignedReadUrls } from "@/lib/platform/supabase-storage";

export type FeedbackImageTile = {
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

  const result = await getFeedbackImagesPage(page, pageSize);

  // Batch-sign only the URLs for this page — not the whole feedback table.
  const signedUrls = await createSignedReadUrls(
    result.items.map((item) => item.imageUrl),
  );

  const items: FeedbackImageTile[] = result.items.flatMap((item) => {
    const signedUrl = signedUrls.get(item.imageUrl);
    if (!signedUrl) return [];
    return [
      {
        key: item.id,
        label:
          item.type === FeedbackType.ISSUE
            ? "Feedback screenshot — issue"
            : "Feedback screenshot — idea",
        sublabel: `${item.user.email ?? item.user.name ?? "Unknown user"}${item.org ? ` · ${item.org.name}` : ""}`,
        src: signedUrl,
        href: signedUrl,
      },
    ];
  });

  return NextResponse.json({
    items,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
    page: result.page,
    pageSize: result.pageSize,
  });
}
