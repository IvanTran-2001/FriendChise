import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/authz/_shared";
import { parseRequestBody } from "@/lib/http/request-body";
import { joinFranchise as joinFranchiseService } from "@/lib/services/orgs";
import { joinFranchiseSchema } from "@/lib/validators/org";
import { getPublicUrl } from "@/lib/platform/supabase-storage";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = joinFranchiseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        errors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const { org } = await joinFranchiseService(user.id, user.email, parsed.data);
    return NextResponse.json(
      {
        organization: {
          id: org.id,
          name: org.name,
          image: org.image ? getPublicUrl(org.image) : null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to join organization",
      },
      { status: 400 },
    );
  }
}