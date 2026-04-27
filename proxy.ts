// ─── Imports ─────────────────────────────────────────────────────────────────

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
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
//   /api/auth/callback|signin  →  IP-based,   20 req / 15 min  (OAuth DoS guard)
//   /api/**                    →  user-based, 60 req / 1 min   (keyed by JWT user ID,
//                                                                falls back to IP)
//
// Rate limiting is skipped entirely when UPSTASH_REDIS_REST_URL is not set
// (e.g. local dev without Redis, CI). This is intentional fail-open behaviour.

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "15 m"),
      prefix: "rl:auth",
    })
  : null;

const apiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:api",
    })
  : null;

// ─── IP extraction ───────────────────────────────────────────────────────────
// Vercel sets x-real-ip to the true client IP via its infrastructure layer.
// This header cannot be spoofed by the client — Vercel overwrites it.
// Falls back to the first entry in x-forwarded-for (also set by Vercel).

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "anonymous"
  );
}

// ─── Fail-open wrapper for rate limiting ────────────────────────────────────
// Returns true (allow) when the limiter is not configured or on Redis errors.

async function safeLimit(
  limiter: Ratelimit | null,
  key: string
): Promise<{ success: boolean }> {
  if (!limiter) return { success: true };
  try {
    return await limiter.limit(key);
  } catch (error) {
    Sentry.logger.error("Rate limiter error (failing open)", { error });
    return { success: true };
  }
}

// ─── Proxy entry point ───────────────────────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. API routes — run rate limiting first, then let the request through
  if (pathname.startsWith("/api/")) {
    // Only rate-limit sensitive auth endpoints (callback, signin), not session/csrf
    if (
      pathname.startsWith("/api/auth/callback/") ||
      pathname.startsWith("/api/auth/signin/")
    ) {
      // OAuth flow — no session exists yet, key by IP
      const { success } = await safeLimit(authRatelimit, getIp(req));
      if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    } else if (!pathname.startsWith("/api/auth/")) {
      // Authenticated API (non-auth routes) — key by user ID from JWT, fall back to IP
      const token = await getToken({ req, secret: process.env.AUTH_SECRET! });
      const key = token?.sub ?? getIp(req);
      const { success } = await safeLimit(apiRatelimit, key);
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
    const { success } = await safeLimit(apiRatelimit, key);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  // 3. App routes — enforce auth and attach x-pathname header
  // TODO: tighten type when next-auth exports a public middleware type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authProxy as any)(req);
}

