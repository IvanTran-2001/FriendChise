import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { normalizeEmail } from "@/lib/core/utils";

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
  // Account linking is intentionally NOT enabled: each Google/LinkedIn
  // identity must map to its own User. If a provider reports an email that
  // already belongs to another user, Auth.js throws OAuthAccountNotLinked
  // instead of silently signing the user into the existing account.
  providers: [
    Google({
      // Only select_account: forces the picker every time without also
      // forcing re-consent (which re-sends Google's "data shared" email).
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    LinkedIn({}),
  ],
  pages: {
    signIn: "/signin",
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
    async signIn({ user, account, profile }) {
      // TEMP diagnostic logging — remove once the account-mixup bug is found.
      console.log("[auth] signIn callback", {
        provider: account?.provider,
        providerAccountId: account?.providerAccountId,
        userEmail: user.email,
        profileEmail: (profile as { email?: string } | undefined)?.email,
      });
      // Normalize email (trim + lowercase) before PrismaAdapter persists it
      // This ensures case-insensitive lookups work reliably
      if (user.email) {
        user.email = normalizeEmail(user.email);
      }
      return true;
    },
  },
};
