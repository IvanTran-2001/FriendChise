import { NextResponse } from "next/server";
import { requireSuperAdminAction } from "@/lib/authz";
import { prisma } from "@/lib/platform/prisma";
import { getPublicUrl } from "@/lib/platform/supabase-storage";

export type OrgLogoTile = {
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

  // Count only orgs that actually have a logo
  const totalCount = await prisma.organization.count({
    where: { image: { not: null } },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1),
    totalPages,
  );

  const orgs = await prisma.organization.findMany({
    where: { image: { not: null } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, name: true, image: true },
  });

  // Org logos live in the public bucket — no signing needed.
  const items: OrgLogoTile[] = orgs.map((org) => ({
    key: org.id,
    label: org.name,
    sublabel: "Organization logo from the public bucket",
    src: getPublicUrl(org.image!),
    href: getPublicUrl(org.image!),
  }));

  return NextResponse.json({ items, totalCount, totalPages, page, pageSize });
}
