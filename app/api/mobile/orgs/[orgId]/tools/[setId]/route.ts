import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getToolItemListDetail } from "@/lib/services/tools";

type RouteContext = { params: Promise<{ orgId: string; setId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { orgId, setId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const toolSet = await getToolItemListDetail(setId, orgId);
  if (!toolSet) {
    return NextResponse.json({ error: "Tool set not found" }, { status: 404 });
  }

  return NextResponse.json({ toolSet });
}
