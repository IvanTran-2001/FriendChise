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

const { auth: proxy } = NextAuth(authConfig);

export { proxy };

export const config = {
  matcher: ["/", "/orgs/:path*"],
};
