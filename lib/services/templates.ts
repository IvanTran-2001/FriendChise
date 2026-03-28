import { prisma } from "@/lib/prisma";

export async function getTimetableTemplates(orgId: string) {
  return prisma.template.findMany({
    where: { orgId },
    include: {
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTimetableTemplate(orgId: string, templateId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, orgId },
    include: {
      entries: {
        include: {
          task: { select: { id: true, name: true, durationMin: true } },
          assignees: {
            where: { membership: { orgId } },
            include: {
              membership: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: [{ dayIndex: "asc" }, { startTimeMin: "asc" }],
      },
    },
  });
}
