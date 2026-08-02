import { PermissionAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/authz";
import { adjudicateScanTaskDuplicate } from "@/lib/ai/scan-to-task/s2t-batch";
import { prisma } from "@/lib/platform/prisma";
import { findPotentialTaskDuplicates } from "@/lib/services/tasks";
import { scanTaskDraftSchema } from "@/lib/validators/scan-to-task";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const authz = await requireOrgPermission(orgId, PermissionAction.MANAGE_TASKS);
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  try {
    const records = await prisma.scanTaskResult.findMany({
      where: { orgId, clearedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        batchId: true,
        fileName: true,
        fileKind: true,
        fileSize: true,
        draft: true,
        error: true,
        taskId: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const recordsWithDuplicates = await Promise.all(
      records.map(async (record) => {
        const parsedDraft = record.draft ? scanTaskDraftSchema.safeParse(record.draft) : null;
        if (!parsedDraft?.success) {
          return { ...record, duplicateCandidates: [] };
        }

        const duplicateCandidates = await findPotentialTaskDuplicates(orgId, {
          title: parsedDraft.data.title,
          description: parsedDraft.data.description,
          sourceText: parsedDraft.data.sourceText || undefined,
        });

        const filteredCandidates = await Promise.all(
          (record.taskId ? duplicateCandidates.filter((candidate) => candidate.taskId !== record.taskId) : duplicateCandidates).map(
            async (candidate) => {
              const adjudication = await adjudicateScanTaskDuplicate(
                {
                  title: parsedDraft.data.title,
                  summary: parsedDraft.data.summary,
                  description: parsedDraft.data.description,
                  sourceText: parsedDraft.data.sourceText,
                  importantDetails: [],
                  actionItems: [],
                },
                candidate,
              );

              if (adjudication?.sameTask === false) return null;
              return candidate;
            },
          ),
        ).then((candidates) => candidates.filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null));

        return { ...record, duplicateCandidates: filteredCandidates };
      }),
    );

    const hasMore = recordsWithDuplicates.length > limit;
    const page = hasMore ? recordsWithDuplicates.slice(0, limit) : recordsWithDuplicates;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return NextResponse.json({
      results: page,
      nextCursor,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load scan history." }, { status: 400 });
  }
}