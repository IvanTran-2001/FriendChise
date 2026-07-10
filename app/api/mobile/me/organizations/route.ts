import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/supabase-storage";

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