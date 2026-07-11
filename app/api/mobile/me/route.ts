import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/authz/_shared";
import { prisma } from "@/lib/prisma";

type MeResponse = {
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response: MeResponse = {
    user: {
      id: user.id,
      name: user.name,
      image: user.image,
    },
  };

  return NextResponse.json(response);
}