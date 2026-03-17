"use server";

import { requireOrgMember } from "@/lib/authz";
import { createTask } from "@/lib/services/tasks";
import { createTaskSchema } from "@/lib/validators/task";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CreateTaskFormState =
  | { ok: false; errors: Record<string, string[]> }
  | { ok: true }
  | null;

export async function createTaskAction(
  orgId: string,
  _prev: CreateTaskFormState,
  formData: FormData,
): Promise<CreateTaskFormState> {
  const authz = await requireOrgMember(orgId);
  if (!authz.ok) return { ok: false, errors: { _: ["Unauthorized"] } };

  const num = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  };

  const raw = {
    title: String(formData.get("title") ?? ""),
    description: formData.get("description") || undefined,
    durationMin: num("durationMin"),
    preferredStartTimeMin: num("preferredStartTimeMin"),
    peopleRequired: num("peopleRequired") ?? 1,
    minWaitDays: num("minWaitDays"),
    maxWaitDays: num("maxWaitDays"),
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await createTask(orgId, parsed.data);
  revalidatePath(`/orgs/${orgId}/tasks`);
  redirect(`/orgs/${orgId}/tasks`);
}

