// ─── Imports ─────────────────────────────────────────────────────────────────

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Route matcher ───────────────────────────────────────────────────────────
// Tells Next.js which URLs run through this proxy function.
// Everything else (static files, _next assets) is skipped automatically.

export const config = {
  matcher: ["/", "/orgs/:path*", "/api/:path*"],
};

// ─── Auth protection (app routes) ────────────────────────────────────────────
// Uses the edge-compatible authConfig (no Prisma) to check the signed JWT
// cookie. Redirects unauthenticated users to /signin automatically.
// Also forwards the current pathname as x-pathname so server components
// can read the active route without usePathname().

const { auth } = NextAuth(authConfig);

const authProxy = auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

// ─── Rate limiting (API routes) ──────────────────────────────────────────────
// Two limiters backed by Upstash Redis:
//
//   /api/auth/*  →  IP-based,     20 req / 15 min  (DoS guard on OAuth flow)
//   /api/**      →  user-based,   60 req / 1 min   (keyed by JWT user ID,
//                                                    falls back to IP)

const redis = Redis.fromEnv();

const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "15 m"),
  prefix: "rl:auth",
});

const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:api",
});

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous"
  );
}

// ─── Proxy entry point ───────────────────────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. API routes — run rate limiting first, then let the request through
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/")) {
      // OAuth flow — no session exists yet, key by IP
      const { success } = await authRatelimit.limit(getIp(req));
      if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    } else {
      // Authenticated API — key by user ID from JWT, fall back to IP
      const token = await getToken({ req, secret: process.env.AUTH_SECRET! });
      const key = token?.sub ?? getIp(req);
      const { success } = await apiRatelimit.limit(key);
      if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }
    return NextResponse.next();
  }

  // 2. Server actions — rate limit by user ID (must be signed in to call actions)
  if (req.method === "POST" && req.headers.has("next-action")) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET! });
    const key = token?.sub ?? getIp(req);
    const { success } = await apiRatelimit.limit(key);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  // 3. App routes — enforce auth and attach x-pathname header
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authProxy as any)(req);
}

