import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getToolItemLists } from "@/lib/services/tools";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const toolSets = await getToolItemLists(orgId);

  return NextResponse.json({ items: toolSets });
}
