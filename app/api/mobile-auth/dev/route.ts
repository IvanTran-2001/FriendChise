import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/platform/prisma";
import { getDevUsers } from "@/app/(auth)/signin/get-dev-users";
import { shouldLogAuthTrace } from "@/lib/platform/auth-trace";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

function isValidCallbackUrl(callbackUrl: string, requestUrl: string): boolean {
  try {
    if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return true;
    }

    const protocol = new URL(callbackUrl).protocol;
    if (protocol === "friendchise:") {
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
  const nodeEnv = process.env["NODE_ENV"] ?? "";
  if (nodeEnv !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const callbackUrl = searchParams.get("callbackUrl");

  function logOutcome(branch: string, details: Record<string, unknown> = {}) {
    if (shouldLogAuthTrace()) {
      console.info("[mobile-auth] dev route", { branch, ...details });
    }
  }

  if (!email) {
    logOutcome("missing_email", { hasCallbackUrl: !!callbackUrl });
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  if (callbackUrl && !isValidCallbackUrl(callbackUrl, request.url)) {
    logOutcome("invalid_callback_url", { hasEmail: true });
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  const devUsers = getDevUsers();
  const devUser = devUsers.find((user) => user.email === email);

  if (!devUser) {
    logOutcome("unmatched_dev_user", { hasEmail: true, hasCallbackUrl: !!callbackUrl });
    return NextResponse.json({ error: "Unknown dev user" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { email: devUser.email } });
  if (!user) {
    logOutcome("missing_authenticated_user", { hasDevUser: true, hasCallbackUrl: !!callbackUrl });
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    maxAge: 60 * 60 * 24 * 30,
  });

  logOutcome("token_issued", { hasCallbackUrl: !!callbackUrl });

  if (!callbackUrl) {
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  }

  const redirectUrl = new URL(callbackUrl, request.url);
  redirectUrl.searchParams.set("token", token);

  return NextResponse.redirect(redirectUrl);
}