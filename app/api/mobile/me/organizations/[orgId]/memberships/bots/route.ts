import { NextResponse } from "next/server";
import { PermissionAction } from "@prisma/client";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/authz";
import { createBot } from "@/lib/services/bots";
import { parseRequestBody } from "@/lib/http/request-body";
import { prisma } from "@/lib/platform/prisma";

type RouteContext = { params: Promise<{ orgId: string }> };

const createBotSchema = z.object({
  botName: z.string().trim().min(1, "Bot name is required").max(100),
  workingDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).default([]),
});

export async function POST(req: Request, { params }: RouteContext) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_MEMBERS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = createBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const defaultRole = await prisma.role.findFirst({
    where: { orgId, isDefault: true },
    select: { id: true },
  });

  if (!defaultRole) {
    return NextResponse.json({ error: "No default role found for this org" }, { status: 400 });
  }

  const result = await createBot(
    orgId,
    {
      botName: parsed.data.botName,
      roleIds: [defaultRole.id],
      workingDays: parsed.data.workingDays,
    },
    authz.userId,
    authz.userEmail,
  );

  if (!result.ok) {
    const status = result.code === "INVALID" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}