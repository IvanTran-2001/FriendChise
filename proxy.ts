import { authConfig } from "@/auth.config";
import NextAuth from "next-auth";

const { auth: proxy } = NextAuth(authConfig);

export { proxy };

// Only run on these routes
export const config = {
  matcher: ["/", "/orgs/:path*"],
};
