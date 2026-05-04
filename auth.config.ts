import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { normalizeEmail } from "@/lib/utils";

/**
 * Edge-compatible Auth.js config.
 *
 * This file intentionally does NOT import Prisma or any Node.js-only modules
 * so it can be used safely in Next.js middleware (Edge runtime).
 *
 * For the full config with Prisma adapter and session callbacks, see auth.ts.
 */
export const authConfig: NextAuthConfig = {
  // allowDangerousEmailAccountLinking is safe here because we are OAuth-only
  // (no email/password sign-up). If email+password is ever added, remove this
  // flag and verify emails before linking accounts.
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    LinkedIn({ allowDangerousEmailAccountLinking: true }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthed = !!auth?.user;
      if (!isAuthed) {
        const { pathname, origin } = new URL(request.url);
        const url = new URL("/signin", origin);
        // For the home page, add a hint so sign-in can show an explanatory prompt.
        if (pathname === "/") {
          url.searchParams.set("hint", "account_required");
        } else {
          url.searchParams.set("callbackUrl", pathname);
        }
        return Response.redirect(url);
      }
      return true;
    },
    async signIn({ user }) {
      // Normalize email (trim + lowercase) before PrismaAdapter persists it
      // This ensures case-insensitive lookups work reliably
      if (user.email) {
        user.email = normalizeEmail(user.email);
      }
      return true;
    },
  },
};
