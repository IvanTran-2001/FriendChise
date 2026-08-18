import { NextResponse } from "next/server";
import { auth, signIn, signOut } from "@/auth";
import { authLogPrefix, traceCookiePresence } from "@/lib/platform/auth-trace";

const ALLOWED_PROVIDERS = new Set(["google", "linkedin"]);

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
  const logPrefix = authLogPrefix(attemptId, "BACKEND");

    if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} OAUTH_START`, {
      provider,
      callbackUrl,
      requestUrl: request.url,
      cookiesPresent: traceCookiePresence(request),
    });
  }

  if (!callbackUrl || !isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  // The system browser keeps its FriendChise session cookie across app-level
  // logouts. Without clearing it here, Auth.js sees the old session and treats
  // this as "already signed in as a different user", throwing
  // OAuthAccountNotLinked instead of starting a fresh sign-in.
  if (process.env.NODE_ENV !== "production") {
    const existing = await auth();
    console.info(`${logPrefix} WEB_SESSION (before signOut)`, { existingUser: existing?.user?.email ?? null });
  }
  await signOut({ redirect: false });

  const authorizationParams = provider === "google" ? { prompt: "select_account" } : undefined;

  if (process.env.NODE_ENV !== "production") {
    console.info(`${logPrefix} REDIRECT -> google authorize`, { destination: callbackUrl });
  }
  await signIn(provider, { redirectTo: callbackUrl }, authorizationParams);
}
