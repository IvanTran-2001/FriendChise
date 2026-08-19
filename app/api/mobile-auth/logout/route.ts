import { NextResponse } from "next/server";
import { signOut } from "@/auth";

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
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl");

  if (!callbackUrl) {
    return NextResponse.json({ error: "callbackUrl required" }, { status: 400 });
  }

  if (!isValidCallbackUrl(callbackUrl, request.url)) {
    return NextResponse.json({ error: "Invalid callbackUrl" }, { status: 400 });
  }

  await signOut({ redirectTo: callbackUrl });
}