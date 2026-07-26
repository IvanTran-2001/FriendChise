export type { ScanTaskDraft } from "@/lib/ai/scan-to-task-inference";
export type { ScanFileKind } from "@/lib/ai/scan-to-task-input";

export {
  buildFallbackScanTaskDraft,
  getScanFileKind,
  inferScanTaskDraft,
  inferScanTaskDrafts,
  inferScanTaskDraftFromStorage,
  inferScanTaskDraftsFromStorage,
} from "@/lib/ai/scan-to-task-inference";

export { getScanSourceSummary } from "@/lib/ai/scan-to-task-input";