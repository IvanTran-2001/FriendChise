import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

  const user = await prisma.user.findFirst({
    where: { id: data.userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid userId: not found" },
      { status: 400 },
    );
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
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Membership already exists" }, { status: 409 });
      }
      if (e.code === "P2003") {
        return NextResponse.json({ error: "Invalid foreign key reference" }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      role: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(memberships);
}
