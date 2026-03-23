import { prisma } from "@/lib/prisma";

export async function getTimetableTemplates(orgId: string) {
  return prisma.timetableTemplate.findMany({
    where: { orgId },
    include: {
      _count: { select: { instances: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTimetableTemplate(orgId: string, templateId: string) {
  return prisma.timetableTemplate.findFirst({
    where: { id: templateId, orgId },
    include: {
      instances: {
        where: { dayOffset: { not: null }, startTimeMin: { not: null } },
        include: {
          task: { select: { id: true, title: true, durationMin: true } },
          assignees: {
            where: {
              membership: { orgId },
            },
            include: {
              membership: {
                include: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: [{ dayOffset: "asc" }, { startTimeMin: "asc" }],
      },
    },
  });
}
