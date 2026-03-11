import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createMembershipSchema = z.object({
  userId: z.string(),
  roleId: z.string().optional(), // must be a real Role.id
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMembershipSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.roleId) {
    // Verify the role exists and belongs to this org
    const role = await prisma.role.findFirst({
      where: { id: data.roleId, orgId },
    });
    if (!role) {
      return NextResponse.json(
        { error: "Invalid roleId: not found or does not belong to this org" },
        { status: 400 },
      );
    }
  }

  try {
    const membership = await prisma.membership.create({
      data: {
        orgId,
        userId: data.userId,
        roleId: data.roleId ?? null,
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (e: unknown) {
    // likely @@unique([orgId, userId]) conflict
    return NextResponse.json(
      {
        error: "Membership already exists (or invalid roleId)",
        detail: String((e as Error)?.message ?? e),
      },
      { status: 409 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const memberships = await prisma.membership.findMany({
    where: { orgId },
    include: {
      user: true,
      role: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(memberships);
}
