"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createOrgSchema } from "@/lib/validators/org";
import { createOrg as createOrgService } from "@/lib/services/orgs";

type CreateOrgResult =
  | { ok: true; orgId: string }
  | { ok: false; error: string };

export async function createOrg(raw: unknown): Promise<CreateOrgResult> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return { ok: false, error: "Unauthorized" };

  const parsed = createOrgSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const { org } = await createOrgService(userId, parsed.data);

  revalidatePath("/", "layout");

  return { ok: true, orgId: org.id };
}
