/**
 * REST endpoint: /api/orgs/[orgId]/task-instances/[taskInstanceId]
 *
 * GET — Fetch a single task instance by id.
 *        Requires the caller to be a member of the org.
 */
import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/authz";
import { getTimetableEntry } from "@/lib/services/timetable-entries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskInstanceId: string }> },
) {
  const { orgId, taskInstanceId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const result = await getTimetableEntry(orgId, taskInstanceId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.data, { status: 200 });
}
