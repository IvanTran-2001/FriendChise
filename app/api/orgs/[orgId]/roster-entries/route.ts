/**
 * GET  /api/orgs/[orgId]/roster-entries?weeks=<ISO>,<ISO>,...
 *      Returns RosterEntry rows for the requested week-start dates.
 *      Accepts up to 20 weeks per request.
 *
 * POST /api/orgs/[orgId]/roster-entries
 *      Replaces every member assigned to a single (weekStart, dayIndex) cell.
 */
import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { requireOrgMember, requireOrgPermission } from "@/lib/authz";
import { parseRequestBody } from "@/lib/http/request-body";
import {
  getRosterEntries,
  setRosterCellMembers,
  type RosterCellMember,
} from "@/lib/services/roster";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const weeksParam = searchParams.get("weeks") ?? "";
  const weekStarts = weeksParam
    .split(",")
    .filter(Boolean)
    .slice(0, 20) // safety cap
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()));

  if (weekStarts.length === 0) {
    return NextResponse.json([]);
  }

  const entries = await getRosterEntries(orgId, weekStarts);
  return NextResponse.json(entries);
}

/** Parses a members array from the request body, or returns null if malformed. */
function parseMembers(value: unknown): RosterCellMember[] | null {
  if (!Array.isArray(value)) return null;

  const members: RosterCellMember[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Record<string, unknown>;
    if (typeof m.membershipId !== "string" || !m.membershipId) return null;

    const start = m.shiftStartMin ?? null;
    const end = m.shiftEndMin ?? null;
    if (start !== null && typeof start !== "number") return null;
    if (end !== null && typeof end !== "number") return null;

    members.push({
      membershipId: m.membershipId,
      shiftStartMin: start,
      shiftEndMin: end,
    });
  }
  return members;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  // Roster writes follow the same permission as the roster server actions.
  const authz = await requireOrgPermission(
    orgId,
    PermissionAction.MANAGE_MEMBERS,
  );
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;
  if (body instanceof FormData) {
    return NextResponse.json(
      { error: "Unsupported media type." },
      { status: 415 },
    );
  }

  const weekStart = new Date(String(body.weekStart ?? ""));
  if (isNaN(weekStart.getTime())) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  const dayIndex = Number(body.dayIndex);
  if (!Number.isInteger(dayIndex)) {
    return NextResponse.json({ error: "Invalid day index" }, { status: 400 });
  }

  const members = parseMembers(body.members);
  if (!members) {
    return NextResponse.json({ error: "Invalid members" }, { status: 400 });
  }

  const result = await setRosterCellMembers(
    orgId,
    weekStart,
    dayIndex,
    members,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "NOT_FOUND" ? 404 : 400 },
    );
  }

  return NextResponse.json({ entries: result.data });
}
