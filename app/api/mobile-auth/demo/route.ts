import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/platform/prisma";
import { prepareDemoSession } from "@/lib/demo";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

function isValidCallbackUrl(callbackUrl: string, requestUrl: string): boolean {
  try {
    if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return true;
    }

    const protocol = new URL(callbackUrl).protocol;
    if (
      protocol === "friendchise:" ||
      protocol === "exp:" ||
      protocol === "exps:"
    ) {
      return true;
    }

    const callback = new URL(callbackUrl);
    const request = new URL(requestUrl);
    return callback.origin === request.origin;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");

  if (!callbackUrl) {
    return NextResponse.json({ error: "callbackUrl required" }, { status: 400 });
  }

  if (!isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  const session = await prepareDemoSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, image: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Demo user not found" }, { status: 404 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
  }

  const token = await encode({
    token: {
      sub: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      picture: user.image ?? undefined,
    },
    secret,
    salt: MOBILE_TOKEN_COOKIE_NAME,
    maxAge: 60 * 60 * 24,
  });

  const redirectUrl = new URL(callbackUrl, request.url);
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("orgId", session.orgId);

  return NextResponse.redirect(redirectUrl);
}