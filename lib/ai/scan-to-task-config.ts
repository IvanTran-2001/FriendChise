const fallbackScanModel = "gpt-4.1-mini";
const configuredScanModel = process.env.OPENAI_SCAN_MODEL?.trim();

export const scanToTaskConfig = {
  model: configuredScanModel || fallbackScanModel,
  debugLogging: process.env.OPENAI_SCAN_DEBUG === "1",
  textTemperature: 0.2,
  imageTemperature: 0.2,
  contextCheckTemperature: 0,
  instructionMaxLength: 2000,
  sourceTextMaxLength: 12000,
  chunkMaxLength: 4000,
  maxChunks: 5,
} as const;

export const scanToTaskOutputKeys =
  "title, description, durationMin, peopleRequired, minWaitDays, maxWaitDays, summary";

export function buildScanToTaskSystemPrompt(sourceDescription: string) {
  return `You are Scan to Task. Convert the ${sourceDescription} into one practical task item. Return valid JSON only with keys ${scanToTaskOutputKeys}. Be conservative, concise, and make the task actionable.`;
}

export function buildScanToTaskImageContextCheckPrompt() {
  return "You are Scan to Task. Decide whether this image contains a document, note, screenshot, form, receipt, handout, or other task-relevant context. Random photos, selfies, scenery, pets, and generic pictures are not actionable. Return valid JSON only with keys actionable and reason. Set actionable to false when the image does not appear to contain useful task context or instructions.";
}