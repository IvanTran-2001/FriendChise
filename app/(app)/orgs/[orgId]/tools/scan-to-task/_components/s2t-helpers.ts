import type { ScanTaskDraft } from "@/lib/ai/scan-to-task";
import type { DraftScanResultItem } from "./s2t-results-section";
import type { TaskDuplicateCandidate } from "@/lib/services/tasks";

export type ReadyScanResult = Extract<DraftScanResultItem, { ok: true }>;

export type ConflictGroup = {
  primaryResult: ReadyScanResult;
  results: ReadyScanResult[];
  duplicateCandidates: TaskDuplicateCandidate[];
};

export type ScanQueueState = {
  results: DraftScanResultItem[];
  draftsById: Record<string, ScanTaskDraft>;
  duplicateCandidatesById: Record<string, TaskDuplicateCandidate[]>;
  selectedResultId: string | null;
};

function dedupeTaskDuplicateCandidates(candidates: TaskDuplicateCandidate[]) {
  const seen = new Set<string>();
  const uniqueCandidates: TaskDuplicateCandidate[] = [];

  for (const candidate of candidates) {
    const candidateKey = candidate.taskId ?? candidate.id;
    if (seen.has(candidateKey)) continue;
    seen.add(candidateKey);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

function getCandidateIdentityKey(candidate: TaskDuplicateCandidate) {
  return candidate.sourceType === "scan-result"
    ? `draft:${candidate.resultId ?? candidate.id}`
    : `task:${candidate.taskId ?? candidate.id}`;
}

type ConflictGroupBucket = {
  duplicateCandidates: TaskDuplicateCandidate[];
  results: ReadyScanResult[];
};

function groupConflictResults(
  results: DraftScanResultItem[],
  duplicateCandidatesById: Record<string, TaskDuplicateCandidate[]>,
  excludedItemIds: Set<string>,
): Map<string, ConflictGroupBucket> {
  const readyResults = results.filter((result): result is ReadyScanResult => result.ok);
  const resultById = new Map(readyResults.map((result) => [result.clientId, result] as const));
  const resultToCandidateKeys = new Map<string, string[]>();
  const candidateToResultIds = new Map<string, Set<string>>();

  for (const result of readyResults) {
    if (excludedItemIds.has(`draft:${result.clientId}`)) continue;

    const candidateKeys = dedupeTaskDuplicateCandidates(duplicateCandidatesById[result.clientId] ?? [])
      .filter((candidate) => !excludedItemIds.has(getCandidateIdentityKey(candidate)))
      .map((candidate) => getCandidateIdentityKey(candidate));

    if (candidateKeys.length === 0) continue;

    resultToCandidateKeys.set(result.clientId, candidateKeys);
    for (const candidateKey of candidateKeys) {
      const current = candidateToResultIds.get(candidateKey) ?? new Set<string>();
      current.add(result.clientId);
      candidateToResultIds.set(candidateKey, current);
    }
  }

  const visitedResults = new Set<string>();
  const visitedCandidates = new Set<string>();
  const groupedByCandidate = new Map<string, ConflictGroupBucket>();

  for (const result of readyResults) {
    if (visitedResults.has(result.clientId) || excludedItemIds.has(`draft:${result.clientId}`)) continue;

    const startCandidateKeys = resultToCandidateKeys.get(result.clientId) ?? [];
    if (startCandidateKeys.length === 0) continue;

    const queue: Array<{ kind: "draft" | "candidate"; id: string }> = [{ kind: "draft", id: result.clientId }];
    const componentResults = new Map<string, ReadyScanResult>();
    const componentCandidates = new Map<string, TaskDuplicateCandidate>();

    while (queue.length > 0) {
      const current = queue.pop();
      if (!current) continue;

      if (current.kind === "draft") {
        if (visitedResults.has(current.id)) continue;
        const currentResult = resultById.get(current.id);
        if (!currentResult) continue;
        visitedResults.add(current.id);
        componentResults.set(current.id, currentResult);

        for (const candidate of dedupeTaskDuplicateCandidates(duplicateCandidatesById[current.id] ?? [])) {
          const candidateKey = getCandidateIdentityKey(candidate);
          if (excludedItemIds.has(candidateKey) || visitedCandidates.has(candidateKey)) continue;
          visitedCandidates.add(candidateKey);
          componentCandidates.set(candidateKey, candidate);
          queue.push({ kind: "candidate", id: candidateKey });
        }
      } else {
        if (visitedCandidates.has(current.id)) {
          // The candidate can already be marked visited when encountered from another draft.
        }

        const linkedResultIds = candidateToResultIds.get(current.id);
        if (!linkedResultIds) continue;

        for (const linkedResultId of linkedResultIds) {
          if (visitedResults.has(linkedResultId)) continue;
          queue.push({ kind: "draft", id: linkedResultId });
        }
      }
    }

    if (componentResults.size === 0 || componentResults.size + componentCandidates.size < 2) continue;

    const bucketKey = [...componentCandidates.keys()].sort().join("|") || [...componentResults.keys()].sort().join("|");
    groupedByCandidate.set(bucketKey, {
      duplicateCandidates: [...componentCandidates.values()],
      results: [...componentResults.values()],
    });
  }

  return groupedByCandidate;
}

export function buildConflictGroups(
  results: DraftScanResultItem[],
  duplicateCandidatesById: Record<string, TaskDuplicateCandidate[]>,
  excludedItemIds: Set<string> = new Set(),
): ConflictGroup[] {
  const groupedByCandidate = groupConflictResults(results, duplicateCandidatesById, excludedItemIds);
  const groups: ConflictGroup[] = [];
  for (const { duplicateCandidates, results: groupedResults } of groupedByCandidate.values()) {
    const sortedResults = [...groupedResults].sort((a, b) => a.fileName.localeCompare(b.fileName));
    const taskCount = dedupeTaskDuplicateCandidates(duplicateCandidates.filter((candidate) => candidate.sourceType === "task")).length;
    const draftCount = sortedResults.length;
    if (draftCount + taskCount < 2) continue;
    groups.push({
      primaryResult: sortedResults[0],
      results: sortedResults,
      duplicateCandidates: dedupeTaskDuplicateCandidates(duplicateCandidates).sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name),
      ),
    });
  }

  return groups.sort((a, b) => a.primaryResult.fileName.localeCompare(b.primaryResult.fileName));
}

export function removeResultFromQueueState(state: ScanQueueState, resultId: string): ScanQueueState {
  const nextResults = state.results.filter((result) => result.clientId !== resultId);
  const nextDrafts = Object.fromEntries(
    Object.entries(state.draftsById).filter(([draftId]) => draftId !== resultId),
  );
  const nextDuplicates = Object.fromEntries(
    Object.entries(state.duplicateCandidatesById).filter(([duplicateId]) => duplicateId !== resultId),
  );

  const nextSelectedResultId =
    state.selectedResultId === resultId
      ? (nextResults.find((result) => result.ok) ?? nextResults[0] ?? null)?.clientId ?? null
      : state.selectedResultId;

  return {
    results: nextResults,
    draftsById: nextDrafts,
    duplicateCandidatesById: nextDuplicates,
    selectedResultId: nextSelectedResultId,
  };
}