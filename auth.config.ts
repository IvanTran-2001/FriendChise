import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

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
  providers: [Google({ allowDangerousEmailAccountLinking: true })],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthed = !!auth?.user;
      if (!isAuthed) {
        const { pathname, origin } = new URL(request.url);
        // Visiting the home page unauthenticated → redirect with a hint so
        // the sign-in page can show an explanatory prompt.
        if (pathname === "/") {
          const url = new URL("/signin", origin);
          url.searchParams.set("hint", "account_required");
          return Response.redirect(url);
        }
      }
      return isAuthed;
    },
    async signIn({ user }) {
      // Normalize email to lowercase before PrismaAdapter persists it
      // This ensures case-insensitive lookups work reliably
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
      return true;
    },
  },
};