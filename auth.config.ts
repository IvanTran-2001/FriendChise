import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-compatible config (no Prisma adapter)
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
