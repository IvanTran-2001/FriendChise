import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint that creates a real Auth.js JWT session cookie for a
 * seeded user, bypassing OAuth. Allows Playwright to authenticate without a
 * browser-based OAuth flow.
 *
 * Only active when TEST_MODE=1 is set (injected by playwright.config.ts via
 * the webServer command). Never exposed in production.
 */
export async function GET(request: Request) {
  if (process.env.TEST_MODE !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "AUTH_SECRET not set" }, { status: 500 });
  }

  // Cookie name matches Auth.js default for HTTP (localhost).
  // On HTTPS (production), Auth.js uses "__Secure-authjs.session-token" —
  // but this endpoint is unreachable in production (TEST_MODE guard above).
  const cookieName = "authjs.session-token";

  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
    },
    secret: process.env.AUTH_SECRET,
    salt: cookieName,
    maxAge: 60 * 60 * 24, // 1 day — enough for a test run
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
