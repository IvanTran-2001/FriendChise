/**
 * Server action for the development credentials sign-in provider.
 *
 * Calls Auth.js `signIn("dev", ...)` which is registered only in
 * `NODE_ENV === "development"` builds. Invoking this in production is a
 * no-op because the provider does not exist.
 */
"use server";

import { signIn } from "@/auth";

/** Signs in as the given seeded dev user and redirects to `callbackUrl`. */
export async function devSignIn(email: string, callbackUrl: string) {
  await signIn("dev", { email, redirectTo: callbackUrl });
}
