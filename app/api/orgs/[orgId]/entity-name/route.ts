/**
 * GET /api/orgs/[orgId]/entity-name?type=tasks|memberships|roles|templates&id=...
 *
 * Resolves a dynamic path segment (DB id) to a human-readable name for the
 * client-side breadcrumb component. Scoped to the org so cross-org leakage
 * is impossible.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "@/lib/authz";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  try {
    let name: string | null = null;

    if (type === "tasks") {
      const row = await prisma.task.findFirst({
        where: { id, orgId },
        select: { name: true },
      });
      name = row?.name ?? null;
    } else if (type === "memberships") {
      const row = await prisma.membership.findFirst({
        where: { id, orgId },
        select: { botName: true, user: { select: { name: true } } },
      });
      name = row?.user?.name ?? row?.botName ?? null;
    } else if (type === "roles") {
      const row = await prisma.role.findFirst({
        where: { id, orgId },
        select: { name: true },
      });
      name = row?.name ?? null;
    } else if (type === "templates") {
      const row = await prisma.template.findFirst({
        where: { id, orgId },
        select: { name: true },
      });
      name = row?.name ?? null;
    }

    if (!name) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
