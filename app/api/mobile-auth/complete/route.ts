import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");

  if (!callbackUrl) {
    return NextResponse.json({ error: "callbackUrl required" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/signin?hint=account_required", request.url));
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
  }

  const token = await encode({
    token: {
      sub: session.user.id,
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      picture: session.user.image ?? undefined,
    },
    secret,
    salt: MOBILE_TOKEN_COOKIE_NAME,
    maxAge: 60 * 60 * 24 * 30,
  });

  const redirectUrl = new URL(callbackUrl);
  redirectUrl.searchParams.set("token", token);

  return NextResponse.redirect(redirectUrl);
}