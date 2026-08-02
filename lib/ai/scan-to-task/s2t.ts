export type { ScanTaskDraft } from "./s2t-inference";
export type { ScanFileKind } from "./s2t-input";

export {
  buildFallbackScanTaskDraft,
  getScanFileKind,
  inferScanTaskDraft,
  inferScanTaskDrafts,
  inferScanTaskDraftFromStorage,
  inferScanTaskDraftsFromStorage,
} from "./s2t-inference";

export { getScanSourceSummary } from "./s2t-input";