import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createOrgSchema = z.object({
  title: z.string().min(1).max(200),
  ownerUserId: z.string().optional(), // until auth is wired
  openTimeMin: z.number().int().min(0).max(1439).optional(),
  closeTimeMin: z.number().int().min(0).max(1439).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createOrgSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Optional extra validation: open < close if both provided
  if (
    data.openTimeMin != null &&
    data.closeTimeMin != null &&
    data.openTimeMin >= data.closeTimeMin
  ) {
    return NextResponse.json(
      { error: "openTimeMin must be less than closeTimeMin" },
      { status: 400 },
    );
  }

  const org = await prisma.organization.create({
    data: {
      title: data.title,
      ownerUserId: data.ownerUserId ?? null,
      openTimeMin: data.openTimeMin ?? null,
      closeTimeMin: data.closeTimeMin ?? null,
    },
  });

  return NextResponse.json(org, { status: 201 });
}

export async function GET() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orgs);
}
