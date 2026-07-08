import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getTasksSimplePage } from "@/lib/services/tasks";

// This route exists for picker UIs that only need task id/name/color and want
// search + paging without pulling in the full task payload.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24), 50);
  const search = searchParams.get("search") ?? undefined;

  const result = await getTasksSimplePage(orgId, { page, pageSize, search });

  return NextResponse.json({
    tasks: result.tasks,
    hasMore: result.page < result.totalPages,
  });
}