const fallbackScanModel = "gpt-4.1-mini";
const configuredScanModel = process.env.OPENAI_SCAN_MODEL?.trim();
const scanDebugFlag =
  process.env.OPENAI_SCAN_DEBUG === "1" ||
  process.env.SCAN_TO_TASK_DEBUG === "1" ||
  process.env.SCAN_DEBUG === "1";
const scanVerboseFlag =
  (process.env.NODE_ENV === "development" && process.env.OPENAI_SCAN_VERBOSE === "1") ||
  process.env.SCAN_TO_TASK_VERBOSE === "1" ||
  process.env.SCAN_VERBOSE === "1";

export const scanToTaskConfig = {
  model: configuredScanModel || fallbackScanModel,
  debugLogging: scanDebugFlag,
  verboseLogging: scanVerboseFlag,
  textTemperature: 0.2,
  imageTemperature: 0.2,
  chunkSplitTemperature: 0,
  chunkSplitMinLength: 2500,
  chunkSplitMaxChunks: 5,
  batchGroupingTemperature: 0.1,
  duplicateAdjudicationTemperature: 0,
  contextCheckTemperature: 0,
  instructionMaxLength: 2000,
  sourceTextMaxLength: 12000,
  chunkMaxLength: 4000,
  maxChunks: 5,
  requestTimeoutMs: 20_000,
} as const;

export const scanToTaskOutputKeys =
  "title, description, durationMin, peopleRequired, minWaitDays, maxWaitDays, summary, sourceText, importantDetails, actionItems";

export function buildScanToTaskSystemPrompt(sourceDescription: string) {
  return `You are Scan to Task. Convert the ${sourceDescription} into one practical task item. Return valid JSON only with keys ${scanToTaskOutputKeys}. Keep titles concise, specific, and action-focused. Write descriptions as clean markdown that is easy for workers to scan: use short paragraphs, bold for key labels or decisions, bullet lists for steps or requirements, and strikethrough only when something is obsolete, optional, or not needed. Avoid dumping raw source text into the description. Preserve exact wording for sourceText whenever it matters, especially measurements, warnings, names, and steps. Use importantDetails for the few details that matter most, and actionItems for any follow-up tasks or checklist items. Be conservative, concise, and make the task actionable.`;
}

export function buildScanToTaskImageContextCheckPrompt() {
  return "You are Scan to Task. Decide whether this image contains a document, note, screenshot, form, receipt, handout, or other task-relevant context. Random photos, selfies, scenery, pets, and generic pictures are not actionable. Return valid JSON only with keys actionable and reason. Set actionable to false when the image does not appear to contain useful task context or instructions.";
}