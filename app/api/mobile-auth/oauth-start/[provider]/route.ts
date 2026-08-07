import { NextResponse } from "next/server";
import { signIn } from "@/auth";

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

  if (!callbackUrl || !isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  await signIn(provider, { redirectTo: callbackUrl });
}
