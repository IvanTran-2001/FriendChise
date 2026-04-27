// ─── Imports ─────────────────────────────────────────────────────────────────

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash } from "crypto";

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

// ─── IP validation and extraction ───────────────────────────────────────────
// Validates IPv4 and IPv6 addresses to prevent XFF header spoofing.

function isValidIpv4(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Pattern.test(ip)) return false;
  return ip.split(".").every((octet) => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

function isValidIpv6(ip: string): boolean {
  // Simplified IPv6 validation - matches standard and compressed formats
  const ipv6Pattern =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::([fF]{4}(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
  return ipv6Pattern.test(ip);
}

function isValidIp(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/**
 * Extracts client IP from request headers with XFF validation.
 *
 * Security considerations:
 * - Only trusts x-forwarded-for when TRUST_PROXY env var is set to "true"
 * - Validates each IP in the XFF chain to prevent spoofing
 * - Returns a stable hash fallback instead of shared "anonymous" string
 *
 * @param req - The incoming Next.js request
 * @returns IP address string or stable hash for rate limiting
 */
function getIp(req: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "true";

  if (trustProxy) {
    const xffHeader = req.headers.get("x-forwarded-for");
    if (xffHeader) {
      // Parse XFF header: split by comma, trim whitespace, validate each IP
      const ips = xffHeader
        .split(",")
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0 && isValidIp(ip));

      // Return the first valid IP (leftmost = original client in standard XFF)
      if (ips.length > 0) {
        return ips[0];
      }
    }
  }

  // Fallback: create a stable hash to prevent shared rate-limit buckets
  // Generate stable hash from User-Agent + pathname to isolate clients
  // This prevents all anonymous users from sharing a single rate limit bucket
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const pathname = req.nextUrl.pathname;
  const hashInput = `${userAgent}:${pathname}`;

  return createHash("sha256").update(hashInput).digest("hex").substring(0, 32);
}

// ─── Fail-open wrapper for rate limiting ────────────────────────────────────
// Wraps rate limiter calls in try/catch to prevent Redis/network errors from
// causing 500s. Returns true (allow) on error to fail open.

async function safeLimit(
  limiter: Ratelimit,
  key: string
): Promise<{ success: boolean }> {
  try {
    return await limiter.limit(key);
  } catch (error) {
    console.error("Rate limiter error (failing open):", error);
    return { success: true }; // fail-open: allow the request
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authProxy as any)(req);
}

