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
  providers: [Google],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
