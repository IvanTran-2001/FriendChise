import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser, getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/platform/prisma";
import { getPublicUrl } from "@/lib/platform/supabase-storage";
import { parseRequestBody } from "@/lib/http/request-body";
import { checkDemoLimit } from "@/lib/demo";
import { createOrgSchema } from "@/lib/validators/org";
import { createOrg as createOrgService } from "@/lib/services/orgs";

type Org = {
  id: string;
  name: string;
  image: string | null;
};

function toOrg(org: { id: string; name: string; image: string | null }): Org {
  return {
    id: org.id,
    name: org.name,
    image: org.image ? getPublicUrl(org.image) : null,
  };
}

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ organizations: [] }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { organization: { name: "asc" } },
    select: {
      organization: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return NextResponse.json({
    organizations: memberships
      .map((membership) => membership.organization)
      .filter((organization): organization is NonNullable<typeof organization> => organization !== null)
      .map(toOrg),
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoCheck = await checkDemoLimit(user.email ?? "", "org", undefined, user.id);
  if (!demoCheck.ok) {
    return NextResponse.json({ error: demoCheck.error }, { status: 429 });
  }

  const body = await parseRequestBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = createOrgSchema.safeParse(body);
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
    const { org } = await createOrgService(user.id, parsed.data, user.email);
    return NextResponse.json(
      {
        organization: {
          id: org.id,
          name: org.name,
          timezone: org.timezone,
          address: org.address,
          operatingDays: org.operatingDays,
          openTimeMin: org.openTimeMin,
          closeTimeMin: org.closeTimeMin,
          image: org.image ? getPublicUrl(org.image) : null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create organization" },
      { status: 500 },
    );
  }
}