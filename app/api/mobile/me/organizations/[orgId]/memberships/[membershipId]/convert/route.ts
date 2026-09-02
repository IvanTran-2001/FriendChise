import { NextResponse } from "next/server";
import { z } from "zod";
import { PermissionAction } from "@prisma/client";
import { requireOrgPermission } from "@/lib/authz";
import { memberToBot, botToMember } from "@/lib/services/bots";
import { parseRequestBody } from "@/lib/http/request-body";

type RouteContext = { params: Promise<{ orgId: string; membershipId: string }> };

const convertSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bot") }),
  z.object({ kind: z.literal("member"), userId: z.string().trim().min(1) }),
]);

export async function POST(req: Request, { params }: RouteContext) {
  const { orgId, membershipId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_MEMBERS);
  if (!authz.ok) return authz.response;

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const result =
    parsed.data.kind === "bot"
      ? await memberToBot(orgId, { membershipId, overrideName: "placeholder" }, authz.userId, authz.userEmail)
      : await botToMember(orgId, { membershipId, userId: parsed.data.userId }, authz.userId);

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "CONFLICT"
          ? 409
          : result.error === "Cannot convert the organization owner to a bot"
            ? 403
            : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}