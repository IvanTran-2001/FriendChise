import { PermissionAction } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/authz";
import { prisma } from "@/lib/platform/prisma";
import {
  getTaskDuplicateCandidateKey,
  loadPotentialTaskDuplicateCandidates,
  scorePotentialTaskDuplicates,
} from "@/lib/services/tasks";
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
  const sharedCandidates = await loadPotentialTaskDuplicateCandidates(orgId, Math.max(limit, DEFAULT_LIMIT));

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

    const hasMore = records.length > limit;
    const pageRecords = hasMore ? records.slice(0, limit) : records;
    const recordsWithDuplicates = [];
    for (const record of pageRecords) {
      const parsedDraft = record.draft ? scanTaskDraftSchema.safeParse(record.draft) : null;
      if (!parsedDraft?.success) {
        recordsWithDuplicates.push({ ...record, duplicateCandidates: [] });
        continue;
      }

      const duplicateCandidates = scorePotentialTaskDuplicates(
        {
          title: parsedDraft.data.title,
          description: parsedDraft.data.description,
          sourceText: parsedDraft.data.sourceText || undefined,
        },
        sharedCandidates,
        { limit: Math.max(limit, DEFAULT_LIMIT), threshold: 0.82 },
      );

      const duplicateVerdicts = getDuplicateCandidateVerdicts(record.metadata);
      const filteredCandidates = duplicateCandidates.filter(
        (candidate) => duplicateVerdicts?.[getTaskDuplicateCandidateKey(candidate)] !== false,
      );

      recordsWithDuplicates.push({ ...record, duplicateCandidates: filteredCandidates });
    }

    const nextCursor = hasMore ? pageRecords[pageRecords.length - 1]?.id ?? null : null;

    return NextResponse.json({
      results: recordsWithDuplicates,
      nextCursor,
    });
  } catch (error) {
    console.error("Failed to load scan history:", error);
    return NextResponse.json({ error: "Failed to load scan history." }, { status: 500 });
  }
}

function getDuplicateCandidateVerdicts(metadata: unknown) {
  if (!isRecord(metadata)) return null;
  const verdicts = metadata.duplicateCandidateVerdicts;
  if (!isRecord(verdicts)) return null;

  return Object.fromEntries(Object.entries(verdicts).filter(([, verdict]) => typeof verdict === "boolean")) as Record<
    string,
    boolean
  >;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}