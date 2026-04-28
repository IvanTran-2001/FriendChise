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
      timeout: 500,
    })
  : null;

const apiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:api",
      timeout: 500,
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

type LimitResult = Awaited<ReturnType<Ratelimit["limit"]>>;

async function safeLimit(
  limiter: Ratelimit | null,
  key: string
): Promise<LimitResult> {
  if (!limiter) return { success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
  try {
    return await limiter.limit(key);
  } catch (error) {
    Sentry.logger.error("Rate limiter error (failing open)", { error });
    return { success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() };
  }
}

function tooManyRequests(result: LimitResult) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

// ─── Proxy entry point ───────────────────────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip all rate limiting in test mode so Playwright workers don't exhaust the
  // per-user bucket (all workers run as the same test user).
  // Explicitly blocked in production so a misconfigured TEST_MODE env var can
  // never disable rate limiting on a live deployment.
  const isTestMode =
    process.env.TEST_MODE === "1" && process.env.NODE_ENV !== "production";

  // 1. API routes — run rate limiting first, then let the request through
  if (pathname.startsWith("/api/")) {
    // Only rate-limit sensitive auth endpoints (callback, signin), not session/csrf
    if (!isTestMode) {
      if (
        pathname.startsWith("/api/auth/callback/") ||
        pathname.startsWith("/api/auth/signin/")
      ) {
        // OAuth flow — no session exists yet, key by IP
        const authResult = await safeLimit(authRatelimit, getIp(req));
        if (!authResult.success) return tooManyRequests(authResult);
      } else if (!pathname.startsWith("/api/auth/")) {
        // Authenticated API (non-auth routes) — key by user ID from JWT, fall back to IP
        const token = await getToken({ req, secret: process.env.AUTH_SECRET! });
        const key = token?.sub ?? getIp(req);
        const apiResult = await safeLimit(apiRatelimit, key);
        if (!apiResult.success) return tooManyRequests(apiResult);
      }
    }
    return NextResponse.next();
  }

  // 2. Server actions — rate limit by user ID (must be signed in to call actions)
  if (!isTestMode && req.method === "POST" && req.headers.has("next-action")) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET! });
    const key = token?.sub ?? getIp(req);
    const actionResult = await safeLimit(apiRatelimit, key);
    if (!actionResult.success) return tooManyRequests(actionResult);
  }

  // 3. App routes — enforce auth and attach x-pathname header
  // TODO: tighten type when next-auth exports a public middleware type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authProxy as any)(req);
}

