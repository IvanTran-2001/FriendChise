import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/platform/prisma";
import { getPublicUrl } from "@/lib/platform/supabase-storage";
import { parseRequestBody } from "@/lib/http/request-body";
import { createOrgSchema } from "@/lib/validators/org";
import { createOrg as createOrgService } from "@/lib/services/orgs";
import { checkDemoLimit } from "@/lib/demo";

type Org = { id: string; name: string; image: string | null };

function toOrg(org: { id: string; name: string; image: string | null }): Org {
  return {
    id: org.id,
    name: org.name,
    image: org.image ? getPublicUrl(org.image) : null,
  };
}

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ organizations: [], activeOrganization: null, totalCount: 0, totalPages: 1, page: 1, pageSize: 24, search: "" });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, Number.parseInt(searchParams.get("limit") ?? "24", 10) || 24), 100);
  const search = searchParams.get("search")?.trim() ?? "";
  const activeOrgId = searchParams.get("activeOrgId")?.trim() || null;

  const where = {
    userId,
    ...(search
      ? {
          organization: {
            is: {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          },
        }
      : {}),
  };

  const totalCount = await prisma.membership.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageNumber = Math.min(page, totalPages);

  const memberships = await prisma.membership.findMany({
    where,
    select: {
      organization: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { organization: { name: "asc" } },
    skip: (pageNumber - 1) * pageSize,
    take: pageSize,
  });

  const organizations = memberships
    .map((membership) => membership.organization)
    .filter((organization): organization is NonNullable<typeof organization> => organization !== null)
    .map(toOrg);

  const activeOrganization = activeOrgId
    ? await prisma.membership
        .findFirst({
          where: { userId, orgId: activeOrgId },
          select: {
            organization: {
              select: { id: true, name: true, image: true },
            },
          },
        })
        .then((membership) => (membership?.organization ? toOrg(membership.organization) : null))
    : null;

  return NextResponse.json({
    organizations,
    activeOrganization,
    totalCount,
    totalPages,
    page: pageNumber,
    pageSize,
    search,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  const userEmail = session?.user?.email as string | undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoCheck = await checkDemoLimit(userEmail ?? "", "org", undefined, userId);
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
    const { org } = await createOrgService(userId, parsed.data, userEmail);
    revalidatePath("/", "layout");
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