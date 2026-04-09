/**
 * Next.js middleware for route-level auth protection.
 *
 * Uses the edge-compatible authConfig (no Prisma) so it runs on the
 * Edge runtime without a database round-trip — session validity is checked
 * via the signed JWT cookie alone.
 *
 * The `authorized` callback in authConfig redirects unauthenticated users
 * to /signin automatically.
 */
import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/", "/orgs/:path*"],
};
