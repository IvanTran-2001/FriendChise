import { prisma } from "@/lib/prisma";
import type { ServiceResult } from "./types";
import type { CreateTaskInput } from "@/lib/validators/task";

export async function createTask(orgId: string, data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      orgId,
      title: data.title,
      description: data.description ?? null,
      durationMin: data.durationMin,
      preferredStartTimeMin: data.preferredStartTimeMin ?? null,
      peopleRequired: data.peopleRequired ?? 1,
      minWaitDays: data.minWaitDays ?? null,
      maxWaitDays: data.maxWaitDays ?? null,
    },
  });
}

export async function deleteTask(
  orgId: string,
  id: string,
): Promise<ServiceResult<null>> {
  const { count } = await prisma.task.deleteMany({ where: { id, orgId } });
  if (count === 0)
    return { ok: false, error: "Task not found", code: "NOT_FOUND" };
  return { ok: true, data: null };
}

export async function getTasks(orgId: string) {
  return prisma.task.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}
