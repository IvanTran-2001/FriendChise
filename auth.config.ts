import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { normalizeEmail } from "@/lib/core/utils";

const useSecureCookies = process.env.NODE_ENV === "production";

/**
 * Edge-compatible Auth.js config.
 *
 * This file intentionally does NOT import Prisma or any Node.js-only modules
 * so it can be used safely in Next.js middleware (Edge runtime).
 *
 * For the full config with Prisma adapter and session callbacks, see auth.ts.
 */
export const authConfig: NextAuthConfig = {
  // Required behind Vercel's proxy — without it Auth.js can reject the
  // incoming Host header as untrusted, which surfaces as error=Configuration
  // on every signin/callback request (Google, LinkedIn, and Credentials alike).
  trustHost: true,
  providers: [
    // Both providers verify email ownership, so linking a new OAuth account
    // to an existing user with the same email is safe here. Without this,
    // any account whose email already exists (e.g. seeded/demo/dev users, or
    // a user who previously signed in with the other provider) hits
    // OAuthAccountNotLinked and lands on Auth.js's generic error page —
    // this was the intermittent "sometimes shows an error page" sign-in bug.
    Apple({ checks: ["pkce", "state"], allowDangerousEmailAccountLinking: true }),
    Google({ checks: ["pkce", "state"], allowDangerousEmailAccountLinking: true }),
    LinkedIn({ checks: ["pkce", "state"], allowDangerousEmailAccountLinking: true }),
  ],
  pages: {
    signIn: "/signin",
  },
  // Apple's callback arrives as a cross-site POST (response_mode=form_post),
  // so the default SameSite=Lax state/PKCE cookies never reach the callback
  // request and Auth.js fails with a generic "Server error" page. SameSite=None
  // (Secure in production) lets those cookies survive the cross-site POST.
  cookies: {
    state: {
      options: {
        sameSite: useSecureCookies ? "none" : "lax",
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      options: {
        sameSite: useSecureCookies ? "none" : "lax",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthed = !!auth?.user;
      if (!isAuthed) {
        const { pathname, search, origin } = new URL(request.url);
        // The home page is public — anonymous visitors see the marketing
        // homepage there instead of being redirected to /signin.
        if (pathname === "/") return true;
        const url = new URL("/signin", origin);
        url.searchParams.set("callbackUrl", pathname + search);
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
