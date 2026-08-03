"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import { scanTaskDraftSchema, type ScanTaskResultMetadata } from "@/lib/validators/scan-to-task";
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
  const [duplicateCandidatesById, setDuplicateCandidatesById] = useState<Record<string, import("@/lib/services/tasks").TaskDuplicateCandidate[]>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

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
    const nextCandidates = Object.fromEntries(
      data.results
        .filter((record) => Array.isArray(record.duplicateCandidates))
        .map((record) => [record.id, record.duplicateCandidates]),
    ) as Record<string, import("@/lib/services/tasks").TaskDuplicateCandidate[]>;

    if (append) {
      setResults((current) => mergeResults(current, parsed));
      setDuplicateCandidatesById((current) => ({ ...current, ...nextCandidates }));
    } else {
      setResults(parsed);
      setDuplicateCandidatesById(nextCandidates);
    }
    setNextCursor(data.nextCursor);
  }, [mergeResults]);

  const loadHistoryPage = useCallback(async (cursor: string | null | undefined, append: boolean) => {
    const requestId = ++requestIdRef.current;
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingInitial(true);
    }

    try {
      const response = await fetch(buildUrl(cursor));
      const data = (await response.json()) as HistoryPage;
      if (requestId !== requestIdRef.current) return;
      applyHistoryPage(data, append);
    } catch {
      if (requestId !== requestIdRef.current) return;
      if (append) return;
      setResults([]);
      setDuplicateCandidatesById({});
      setNextCursor(null);
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoadingInitial(false);
      }
    }
  }, [applyHistoryPage, buildUrl]);

  const refreshHistory = useCallback(() => loadHistoryPage(null, false), [loadHistoryPage]);

  useEffect(() => {
    void loadHistoryPage(null, false);
  }, [loadHistoryPage]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !nextCursor) return;

    void loadHistoryPage(nextCursor, true).catch(() => {
      // Best effort only; the next intersection will retry.
    });
  }, [isLoadingMore, loadHistoryPage, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
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
    hasMore: Boolean(nextCursor),
    sentinelRef,
    setResults,
    refreshHistory,
  };
}