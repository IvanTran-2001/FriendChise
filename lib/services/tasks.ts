import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "./types";
import type { CreateTaskInput } from "@/lib/validators/task";

/**
 * Creates a new task for the given org using validated input.
 * Optional fields are null-coalesced so callers never need to handle `undefined`.
 */
export async function createTask(orgId: string, data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      orgId,
      name: data.title,
      description: data.description ?? null,
      durationMin: data.durationMin,
      preferredStartTimeMin: data.preferredStartTimeMin ?? null,
      minPeople: data.peopleRequired ?? 1,
      minWaitDays: data.minWaitDays ?? null,
      maxWaitDays: data.maxWaitDays ?? null,
    },
  });
}

/**
 * Deletes a task by id, scoped to `orgId` to prevent cross-org deletion.
 * Returns a NOT_FOUND error if no matching record exists.
 */
export async function deleteTask(
  orgId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.task.deleteMany({ where: { id, orgId } });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  return { ok: true, data: null };
}

/**
 * Returns all tasks for the given org, sorted newest-first.
 * Includes role eligibility data for display in the task table.
 */
export async function getTasks(orgId: string) {
  return prisma.task.findMany({
    where: { orgId },
    include: {
      eligibility: {
        select: {
          role: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
