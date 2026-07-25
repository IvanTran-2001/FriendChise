import { prisma } from "@/lib/platform/prisma";

/**
 * Returns all note pages for an organization, sorted by position ascending.
 */
export async function getNotePages(orgId: string) {
  return prisma.notePage.findMany({
    where: { orgId },
    orderBy: { position: "asc" },
  });
}

/**
 * Returns a single note page by id and orgId.
 */
export async function getNotePage(orgId: string, id: string) {
  return prisma.notePage.findFirst({
    where: { id, orgId },
  });
}

/**
 * Creates a new note page, appending it to the end (max position + 1).
 */
export async function createNotePage(orgId: string, title: string, content = "") {
  const maxPosPage = await prisma.notePage.findFirst({
    where: { orgId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = maxPosPage ? maxPosPage.position + 1 : 0;

  return prisma.notePage.create({
    data: {
      orgId,
      title,
      content,
      position,
    },
  });
}

/**
 * Updates a note page.
 */
export async function updateNotePage(
  orgId: string,
  id: string,
  data: { title?: string; content?: string; position?: number },
) {
  return prisma.notePage.updateMany({
    where: { id, orgId },
    data,
  });
}

/**
 * Deletes a note page.
 */
export async function deleteNotePage(orgId: string, id: string) {
  return prisma.notePage.deleteMany({
    where: { id, orgId },
  });
}

/**
 * Atomically updates positions for all page IDs.
 */
export async function reorderNotePages(orgId: string, pageIds: string[]) {
  return prisma.$transaction(
    pageIds.map((id, index) =>
      prisma.notePage.updateMany({
        where: { id, orgId },
        data: { position: index },
      }),
    ),
  );
}
