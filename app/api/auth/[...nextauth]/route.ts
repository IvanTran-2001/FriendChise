/**
 * Next.js App Router catch-all that delegates all Auth.js HTTP traffic
 * (OAuth redirects, provider callbacks, session endpoints) to the library's
 * built-in handlers. No custom logic lives here.
 */
import { handlers } from "@/auth";

export const GET = handlers.GET;
export const POST = handlers.POST;
