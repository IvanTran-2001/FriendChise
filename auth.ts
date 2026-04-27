import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import * as Sentry from "@sentry/nextjs";

/**
 * Full Auth.js config. Used by API routes and server components (Node.js runtime only).
 *
 * Extends authConfig with:
 * - PrismaAdapter: persists User + Account records to Postgres for OAuth account linking
 * - JWT session strategy: sessions are stored in a signed cookie, not the database,
 *   so middleware can verify them on the Edge without a DB round-trip
 * - session callback: maps token.sub (the user's DB id) onto session.user.id
 *   so API routes can query Membership records by userId
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // ← change this
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      // ← token, not user
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    signIn({ user }) {
      Sentry.logger.info("User signed in", { userId: user.id });
    },
    signOut({ token }) {
      Sentry.logger.info("User signed out", { userId: token?.sub });
    },
  },
});
