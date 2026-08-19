import { NextResponse } from "next/server";
import { signIn } from "@/auth";
import { authLogPrefix, shouldLogAuthTrace, traceCookiePresence } from "@/lib/platform/auth-trace";

const ALLOWED_PROVIDERS = new Set(["google", "linkedin"]);
const OAUTH_START_STATE_COOKIE = "friendchise.oauth-start-state";

function isValidCallbackUrl(callbackUrl: string, requestUrl: string): boolean {
  try {
    // Allow relative paths (same-origin)
    if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return true;
    }

    // Allow only the app's registered deep-link scheme.
    const protocol = new URL(callbackUrl).protocol;
    if (protocol === "friendchise:") {
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

function readCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Mobile-only OAuth entry point.
 *
 * Auth.js v5 requires a CSRF-tokened POST for `/api/auth/signin/[provider]`,
 * so the mobile app cannot open that URL directly in the system browser (it
 * always fails with error=Configuration). Calling `signIn()` here invokes
 * Auth.js internally instead of over HTTP, sidestepping that CSRF check the
 * same way the website's own sign-in page server actions do.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");
  const attemptId = searchParams.get("attemptId");
  const state = searchParams.get("state");
  const logPrefix = authLogPrefix(attemptId, "BACKEND");

  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} OAUTH_START`, {
      provider,
      hasCallbackUrl: !!callbackUrl,
      cookiesPresent: traceCookiePresence(request),
    });
  }

  if (!callbackUrl || !isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  if (!state) {
    const bootstrapState = crypto.randomUUID();
    const bootstrapUrl = new URL(request.url);
    bootstrapUrl.searchParams.set("state", bootstrapState);

    const bootstrapResponse = NextResponse.redirect(bootstrapUrl);
    bootstrapResponse.cookies.set({
      name: OAUTH_START_STATE_COOKIE,
      value: bootstrapState,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/mobile-auth/oauth-start",
      maxAge: 60,
    });

    if (shouldLogAuthTrace()) {
      console.info(`${logPrefix} STATE_BOOTSTRAP`, {
        provider,
        hasCallbackUrl: !!callbackUrl,
      });
    }

    return bootstrapResponse;
  }

  const expectedState = readCookieValue(request, OAUTH_START_STATE_COOKIE);
  if (!expectedState || expectedState !== state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 403 });
  }

  const authorizationParams = provider === "google" ? { prompt: "select_account" } : undefined;

  if (shouldLogAuthTrace()) {
    console.info(`${logPrefix} REDIRECT -> ${provider} authorize`, { hasCallbackUrl: !!callbackUrl });
  }
  const completionUrl = new URL("/api/mobile-auth/complete", request.url);
  completionUrl.searchParams.set("callbackUrl", callbackUrl);
  if (attemptId) {
    completionUrl.searchParams.set("attemptId", attemptId);
  }

  await signIn(provider, { redirectTo: completionUrl.toString() }, authorizationParams);
}
