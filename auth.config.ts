import type { NextAuthConfig } from "next-auth";
import Apple from "next-auth/providers/apple";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import Twitter from "next-auth/providers/twitter";

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
    Apple({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
    LinkedIn({ allowDangerousEmailAccountLinking: true }),
    MicrosoftEntraId({ allowDangerousEmailAccountLinking: true }),
    Twitter({ allowDangerousEmailAccountLinking: true }),
  ],
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
  },
};
