import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authLogPrefix, shouldLogAuthTrace, traceCookiePresence } from "@/lib/platform/auth-trace";

const MOBILE_TOKEN_COOKIE_NAME = "friendchise.mobile-session-token";

function isValidCallbackUrl(callbackUrl: string, requestUrl: string): boolean {
  try {
    // Allow relative paths (same-origin)
    if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return true;
    }

    // Allow the mobile app's deep-link schemes.
    const protocol = new URL(callbackUrl).protocol;
    if (
      protocol === "friendchise:" ||
      protocol === "exp:" ||
      protocol === "exps:"
    ) {
      return true;
    }

    // For absolute URLs, validate against request origin
    const callback = new URL(callbackUrl);
    const request = new URL(requestUrl);
    return callback.origin === request.origin;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");
  const attemptId = searchParams.get("attemptId");
  const logPrefix = authLogPrefix(attemptId, "BACKEND");

  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} MOBILE_CALLBACK route start`, {
      hasCallbackUrl: !!callbackUrl,
      cookiesPresent: traceCookiePresence(request),
    });
  }

  if (!callbackUrl) {
    return NextResponse.json({ error: "callbackUrl required" }, { status: 400 });
  }

  if (!isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  const session = await auth();
  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} AUTHJS_SESSION`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasUserId: !!session?.user?.id,
      hasEmail: !!session?.user?.email,
      hasExpires: !!session?.expires,
    });
  }
  if (!session?.user?.id) {
    if (shouldLogAuthTrace()) {
      console.info(`${logPrefix} REDIRECT -> /signin (no session found)`, {
        hasCallbackUrl: !!callbackUrl,
        cookiesPresent: traceCookiePresence(request),
      });
    }
    return NextResponse.redirect(new URL("/signin?hint=account_required", request.url));
  }

  const expiresAt = Date.parse(session.expires);
  if (!Number.isFinite(expiresAt)) {
    return NextResponse.json({ error: "Invalid session expiry" }, { status: 500 });
  }
  const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
  if (maxAge <= 0) {
    return NextResponse.json({ error: "Invalid session expiry" }, { status: 500 });
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
    maxAge,
  });

  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} issuing mobile session token`, {
      hasUser: !!session.user,
      hasIssuedToken: !!token,
    });
  }

  const redirectUrl = new URL(callbackUrl, request.url);
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("expiresAt", String(expiresAt));

  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} REDIRECT -> deep link`, {
      hasUser: !!session.user,
      hasRedirectUrl: true,
    });
  }

  return NextResponse.redirect(redirectUrl);
}