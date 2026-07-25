"use server";

/**
 * Server actions for launching a demo session.
 *
 * startDemoSessionAction — provisions a seeded demo org/user and signs the
 * visitor in, redirecting to `redirectTo` on success. Used from both the
 * marketing homepage hero and the sign-in page so the two surfaces share one
 * code path for provisioning + error handling.
 */

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { DemoProvisionError, prepareDemoSession } from "@/lib/demo";

export async function startDemoSessionAction(redirectTo = "/") {
  let session: { userId: string; orgId: string } | undefined;
  try {
    session = await prepareDemoSession();
  } catch (err) {
    console.error("[demo] prepareDemoSession failed:", err);
    if (err instanceof DemoProvisionError) {
      redirect(`/signin?hint=${err.code}`);
    }
    redirect("/signin?hint=demo_unavailable");
  }
  if (!session) return;
  await signIn("demo", { userId: session.userId, redirectTo });
}
