import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { log } from "@/lib/observability";
import { isDemoEmail, DEMO_JWT_TTL_MS } from "@/lib/demo";

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
  providers: [
    ...authConfig.providers,
    // Demo sign-in: only authenticates users whose email ends with
    // @demo.friendchise.app (created exclusively by prepareDemoSession).
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize(credentials) {
        const { userId } = credentials as { userId?: string };
        if (!userId) return null;
        const user = await prisma.user.findFirst({
          where: { id: userId, email: { endsWith: "@demo.friendchise.app" } },
        });
        return user;
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // ← change this
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, account }) {
      // On initial demo sign-in, record the issued time so we can enforce a
      // fixed 2-hour expiry (not a rolling one) for demo sessions.
      if (account && typeof token.email === "string" && isDemoEmail(token.email)) {
        (token as Record<string, unknown>).demoIssuedAt = Math.floor(Date.now() / 1000);
      }
      // Enforce the 2-hour cap on every JWT refresh for demo sessions.
      const demoIssuedAt = (token as Record<string, unknown>).demoIssuedAt;
      if (typeof demoIssuedAt === "number") {
        token.exp = demoIssuedAt + DEMO_JWT_TTL_MS / 1000;
      }
      return token;
    },
    session({ session, token }) {
      // ← token, not user
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      // For demo sessions, sync session.expires to the JWT's fixed 2-hour exp
      // (Next-Auth otherwise sets session.expires from its own rolling maxAge)
      const demoIssuedAt = (token as Record<string, unknown>).demoIssuedAt;
      if (typeof demoIssuedAt === "number" && typeof token.exp === "number") {
        session.expires = new Date(token.exp * 1000).toISOString();
      }
      return session;
    },
  },
  events: {
    signIn({ user }) {
      log.info("User signed in", { userId: user.id });
    },
    signOut(payload) {
      if ("token" in payload && payload.token) {
        log.info("User signed out", { userId: payload.token.sub });
      }
    },
  },
});
