import { NextResponse } from "next/server";

import { requireOrgMember } from "@/lib/authz";
import { getConversionSets, getToolItemLists } from "@/lib/services/tools";
import { getRosterTemplates } from "@/lib/services/roster";

const VALID_KINDS = ["conversion", "item-list", "roster"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const authz = await requireOrgMember((await params).orgId);
  if (!authz.ok) return authz.response;

  const { orgId } = await params;
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");

  if (!kind || !VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  if (kind === "conversion") {
    const conversionSets = await getConversionSets(orgId);
    return NextResponse.json({ items: conversionSets });
  }

  if (kind === "item-list") {
    const itemLists = await getToolItemLists(orgId);
    return NextResponse.json({ items: itemLists });
  }

  const rosterTemplates = await getRosterTemplates(orgId);
  return NextResponse.json({ items: rosterTemplates });
}