import { NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function isValidCallbackUrl(callbackUrl: string, requestUrl: string): boolean {
  try {
    if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return true;
    }

    const protocol = new URL(callbackUrl).protocol;
    if (protocol === "friendchise:" || protocol === "exp:" || protocol === "exps:") {
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
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");

  if (!callbackUrl) {
    return NextResponse.json({ error: "callbackUrl required" }, { status: 400 });
  }

  if (!isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  const redirectUrl = new URL(callbackUrl, request.url);
  const response = NextResponse.redirect(redirectUrl);

  for (const cookieName of SESSION_COOKIE_NAMES) {
    response.cookies.set({
      name: cookieName,
      value: "",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}