"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { scanTaskDraftSchema, type ScanTaskResultMetadata } from "@/lib/validators/scan-to-task";
import type { TaskDuplicateCandidate } from "@/lib/services/tasks";
import type { DraftScanResultItem } from "./s2t-results-section";

type HistoryRecord = {
  id: string;
  batchId: string;
  fileName: string;
  fileKind: string;
  fileSize: number;
  draft: unknown;
  error: string | null;
  taskId: string | null;
  metadata?: ScanTaskResultMetadata | null;
  createdAt: string;
  updatedAt: string;
  duplicateCandidates?: unknown;
};

type HistoryPage = {
  results: HistoryRecord[];
  nextCursor: string | null;
};

const historyDuplicateCandidateSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["task", "scan-result"]),
  name: z.string(),
  description: z.string().nullable(),
  durationMin: z.number().int(),
  minPeople: z.number().int(),
  maxPeople: z.number().int().nullable(),
  color: z.string().nullable(),
  createdAt: z.string(),
  score: z.number(),
  matchedOn: z.array(z.string()),
  topic: z.string().nullable(),
  taskId: z.string().nullable().optional(),
  resultId: z.string().nullable().optional(),
  clearedAt: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
  updatedAt: z.string(),
});

function toHistoryItem(record: HistoryRecord): DraftScanResultItem | null {
  const parsedDraft = record.draft ? scanTaskDraftSchema.safeParse(record.draft) : null;

  if (parsedDraft?.success) {
    return {
      clientId: record.id,
      resultId: record.id,
      ok: true,
      fileName: record.fileName,
      fileKind: record.fileKind,
      fileSize: record.fileSize,
      draft: parsedDraft.data as ScanTaskDraft,
      taskId: record.taskId,
      metadata: record.metadata ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  if (record.error) {
    return {
      clientId: record.id,
      resultId: record.id,
      ok: false,
      fileName: record.fileName,
      fileKind: record.fileKind,
      fileSize: record.fileSize,
      error: record.error,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  return null;
}

export function useScanTaskHistoryPagination(orgId: string, pageSize = 25) {
  const [results, setResults] = useState<DraftScanResultItem[]>([]);
  const [duplicateCandidatesById, setDuplicateCandidatesById] = useState<Record<string, TaskDuplicateCandidate[]>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const initialRequestIdRef = useRef(0);
  const appendRequestIdRef = useRef(0);
  const activeAppendRequestIdRef = useRef(0);

  const buildUrl = useCallback(
    (cursor: string | null | undefined) => {
      const url = new URL(`/api/orgs/${orgId}/tools/scan-to-task/history`, window.location.origin);
      url.searchParams.set("limit", String(pageSize));
      if (cursor) url.searchParams.set("cursor", cursor);
      return url.toString();
    },
    [orgId, pageSize],
  );

  const mergeResults = useCallback((current: DraftScanResultItem[], incoming: DraftScanResultItem[]) => {
    const seen = new Set(current.map((result) => result.clientId));
    const next = [...current];
    for (const item of incoming) {
      if (!seen.has(item.clientId)) {
        seen.add(item.clientId);
        next.push(item);
      }
    }
    return next;
  }, []);

  const applyHistoryPage = useCallback((data: HistoryPage, append: boolean) => {
    const parsed = data.results.map(toHistoryItem).filter((item): item is DraftScanResultItem => item !== null);
    const parseFailureIds: string[] = [];
    const nextCandidates = Object.fromEntries(
      data.results
        .map((record) => {
          const parsedCandidates = historyDuplicateCandidateSchema.array().safeParse(record.duplicateCandidates);
          if (!parsedCandidates.success) {
            parseFailureIds.push(record.id);
          }
          return [record.id, parsedCandidates.success ? parsedCandidates.data : []] as const;
        })
        .filter((entry): entry is readonly [string, TaskDuplicateCandidate[]] => Boolean(entry)),
    );

    if (append) {
      setResults((current) => mergeResults(current, parsed));
      setDuplicateCandidatesById((current) => ({ ...current, ...nextCandidates }));
    } else {
      setResults(parsed);
      setDuplicateCandidatesById(nextCandidates);
    }
    if (parseFailureIds.length > 0) {
      setHistoryError(`Failed to parse duplicate candidates for ${parseFailureIds.length} history record${parseFailureIds.length === 1 ? "" : "s"}.`);
    }
    setNextCursor(data.nextCursor);
  }, [mergeResults]);

  const loadHistoryPage = useCallback(async (cursor: string | null | undefined, append: boolean) => {
    const runHistoryRequest = async ({
      requestId,
      requestIdRef,
      loadingRef,
      errorMessage,
      onSuccess,
      onStaleError,
      onFinally,
    }: {
      requestId: number;
      requestIdRef: RefObject<number>;
      loadingRef: RefObject<number>;
      errorMessage: string;
      onSuccess: (data: HistoryPage) => void;
      onStaleError: () => void;
      onFinally: () => void;
    }) => {
      try {
        const response = await fetch(buildUrl(cursor));
        if (!response.ok) {
          throw new Error(`Failed to load scan history (${response.status}).`);
        }

        const data = (await response.json()) as HistoryPage;
        if (requestId !== requestIdRef.current) return;
        setHistoryError(null);
        onSuccess(data);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setHistoryError(errorMessage);
        onStaleError();
      } finally {
        if (loadingRef.current === requestId) {
          onFinally();
        }
      }
    };

    if (append) {
      const requestId = ++appendRequestIdRef.current;
      activeAppendRequestIdRef.current = requestId;
      setIsLoadingMore(true);

      await runHistoryRequest({
        requestId,
        requestIdRef: appendRequestIdRef,
        loadingRef: activeAppendRequestIdRef,
        errorMessage: "Failed to load more scan history.",
        onSuccess: (data) => applyHistoryPage(data, true),
        onStaleError: () => {},
        onFinally: () => setIsLoadingMore(false),
      });
      return;
    }

    const requestId = ++initialRequestIdRef.current;
    appendRequestIdRef.current += 1;
    setIsLoadingInitial(true);

    await runHistoryRequest({
      requestId,
      requestIdRef: initialRequestIdRef,
      loadingRef: initialRequestIdRef,
      errorMessage: "Failed to load scan history.",
      onSuccess: (data) => applyHistoryPage(data, false),
      onStaleError: () => {},
      onFinally: () => setIsLoadingInitial(false),
    });
  }, [applyHistoryPage, buildUrl]);

  const refreshHistory = useCallback(() => loadHistoryPage(null, false), [loadHistoryPage]);

  useEffect(() => {
    void loadHistoryPage(null, false);
  }, [loadHistoryPage]);

  const loadMore = useCallback(() => {
    if (isLoadingInitial || isLoadingMore || !nextCursor) return;

    void loadHistoryPage(nextCursor, true).catch(() => {
      // Best effort only; the next intersection will retry.
    });
  }, [isLoadingInitial, isLoadingMore, loadHistoryPage, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { root: scrollRootRef.current, rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return {
    results,
    duplicateCandidatesById,
    nextCursor,
    isLoadingInitial,
    isLoadingMore,
    historyError,
    hasMore: Boolean(nextCursor),
    sentinelRef,
    scrollRootRef,
    setResults,
    refreshHistory,
  };
}