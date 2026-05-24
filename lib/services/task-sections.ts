/**
 * Task section layout service.
 *
 * Manages `TaskSectionLayout` rows — per-org, per-task configuration that
 * controls which sections are visible, their display order, and whether they
 * are scoped to the viewing org (ORG) or shared back to the franchisor (GLOBAL).
 *
 * Known section types: "PICTURE", "DETAIL", "COMMENT".
 * New types can be added without a schema migration (type is a plain string).
 *
 * Default behaviour: if no rows exist for a task+org pair, `getSectionLayout`
 * returns virtual DEFAULT_SECTIONS so callers never need a null check.
 * Rows are created lazily on first save or when a task is inherited.
 */
import type { TaskSectionLayout } from "@prisma/client";
import { SectionScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Unified row shape returned by getSectionLayout (DB rows or virtual defaults). */
export type SectionLayoutRow = Omit<TaskSectionLayout, "id"> & { id: string };

export type SectionLayoutInput = {
  type: string;
  title: string;
  scope: SectionScope;
  position: number;
  visible: boolean;
};

export const DEFAULT_SECTIONS: SectionLayoutInput[] = [
  {
    type: "PICTURE",
    title: "Picture",
    scope: SectionScope.ORG,
    position: 0,
    visible: true,
  },
  {
    type: "DETAIL",
    title: "Details",
    scope: SectionScope.ORG,
    position: 1,
    visible: true,
  },
  {
    type: "COMMENT",
    title: "Comments",
    scope: SectionScope.ORG,
    position: 2,
    visible: true,
  },
];

/**
 * Creates the three default section rows for a task+org, skipping any that
 * already exist (safe to call multiple times).
 */
export async function createDefaultSectionLayouts(
  taskId: string,
  orgId: string,
) {
  await prisma.taskSectionLayout.createMany({
    data: DEFAULT_SECTIONS.map((s) => ({ taskId, orgId, ...s })),
    skipDuplicates: true,
  });
}

/**
 * Returns the section layout for a task+org, sorted by position.
 * Falls back to the DEFAULT_SECTIONS constants (without DB ids) when no rows
 * exist yet — callers should treat virtual rows as unsaved.
 */
export async function getSectionLayout(
  taskId: string,
  orgId: string,
): Promise<SectionLayoutRow[]> {
  const rows = await prisma.taskSectionLayout.findMany({
    where: { taskId, orgId },
    orderBy: { position: "asc" },
  });
  if (rows.length > 0) return rows;
  return DEFAULT_SECTIONS.map((s, i) => ({
    id: `virtual-${i}` as string,
    taskId,
    orgId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...s,
  }));
}

/**
 * Bulk-upserts all section layout rows for a task+org in a single transaction.
 * Positions are taken directly from the array; callers are responsible for
 * assigning sequential, gapless position values before calling this.
 */
export async function updateSectionLayouts(
  taskId: string,
  orgId: string,
  sections: SectionLayoutInput[],
) {
  await prisma.$transaction(
    sections.map((s) =>
      prisma.taskSectionLayout.upsert({
        where: { taskId_orgId_type: { taskId, orgId, type: s.type } },
        create: { taskId, orgId, ...s },
        update: {
          title: s.title,
          scope: s.scope,
          position: s.position,
          visible: s.visible,
        },
      }),
    ),
  );
}

/**
 * Copies section layout rows from one org to another for the same task.
 * Falls back to `createDefaultSectionLayouts` if the source org has no rows.
 * Skips rows that already exist for the target org (skipDuplicates).
 */
export async function copySectionLayout(
  taskId: string,
  fromOrgId: string,
  toOrgId: string,
) {
  const source = await prisma.taskSectionLayout.findMany({
    where: { taskId, orgId: fromOrgId },
    orderBy: { position: "asc" },
  });
  if (source.length === 0) {
    await createDefaultSectionLayouts(taskId, toOrgId);
    return;
  }
  await prisma.taskSectionLayout.createMany({
    data: source.map((s) => ({
      taskId,
      orgId: toOrgId,
      type: s.type,
      title: s.title,
      scope: s.scope,
      position: s.position,
      visible: s.visible,
    })),
    skipDuplicates: true,
  });
}
