import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authLogPrefix, traceCookiePresence } from "@/lib/platform/auth-trace";

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

    if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} MOBILE_CALLBACK route start`, {
      callbackUrl,
      requestUrl: request.url,
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
  if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} AUTHJS_SESSION`, { user: session?.user?.email ?? null, userId: session?.user?.id ?? null });
  }
  if (!session?.user?.id) {
      if (process.env.NODE_ENV !== "production") {
      console.info(`${logPrefix} REDIRECT -> /signin (no session found)`, {
        callbackUrl,
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

    if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} issuing mobile session token`, {
      userId: session.user.id,
      email: session.user.email ?? null,
    });
  }

  const redirectUrl = new URL(callbackUrl, request.url);
  redirectUrl.searchParams.set("token", token);
  redirectUrl.searchParams.set("expiresAt", String(expiresAt));

    if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} REDIRECT -> deep link`, {
      userId: session.user.id,
      email: session.user.email ?? null,
      redirectUrl: redirectUrl.toString(),
    });
  }

  return NextResponse.redirect(redirectUrl);
}