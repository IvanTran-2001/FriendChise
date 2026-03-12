import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error("Missing Google OAuth credentials");
}

export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      // Put DB user id onto the session so API routes can authorize by membership
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
