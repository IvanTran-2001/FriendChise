import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getTaskInstance } from "@/lib/services/task-instances";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const result = await getTaskInstance(orgId, taskInstanceId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.data, { status: 200 });
}
