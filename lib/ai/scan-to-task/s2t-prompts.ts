/**
 * Builds the per-chunk drafting prompt used after chunking is already done.
 * This prompt turns one chunk into one task draft.
 */
export function buildScanToTaskChunkDraftPrompt(
  fileName: string,
  safeSourceText: string,
  sectionLabel = "",
) {
  return [
    `File name: ${fileName}`,
    sectionLabel ? `Section: ${sectionLabel}` : null,
    `Extracted content:\n${safeSourceText || "(none)"}`,
    "Return a concise, worker-friendly task draft.",
    "Use only the core task-form fields plus summary and sourceText.",
    "Do not make details up.",
    "Keep the title short and specific; do not echo the file name or repeat the raw source wording unless it is the most useful title.",
    "Write description as clean markdown that is easy to skim. Prefer short paragraphs, bold labels for key facts, bullets for steps or requirements, and strikethrough only when something is obsolete, optional, or no longer needed.",
    "Use sourceText for a near-verbatim transcription of only the useful source material. Keep measurements, timings, warnings, labels, ingredient amounts, and step wording as exact as possible, but do not force raw source text into the description.",
    "If two lines or sections are saying the same thing, remove one of them instead of repeating it.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Builds the instruction used to extract useful text from image uploads.
 */
export function buildScanToTaskImageInstructionPrompt(fileName: string, instruction = "") {
  return [
    `File name: ${fileName}`,
    instruction.trim() ? `Instruction: ${instruction.trim()}` : null,
    "Return a structured OCR-style transcription so the image can be processed like a PDF or text document.",
    "Preserve headings, labels, measurements, warnings, ingredient amounts, numbering, bullets, and step wording as exactly as possible.",
    "Keep the original reading order.",
    "If the image contains multiple recipes, procedures, or instruction sets, output one clearly separated block for each visible card or section.",
    "Use an obvious heading for each block, such as 'Recipe 1:' or the visible title, then put the transcribed lines under it.",
    "Leave a blank line between blocks and keep each block self-contained so the later chunk splitter can treat each block as a distinct unit.",
    "If two recipes appear on the same page, do not merge them into one paragraph even if they share ingredients or formatting.",
    "Do not flatten several recipes into one combined paragraph.",
    "Do not summarize, classify, merge, or draft a task yet.",
    "Do not invent content.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Builds the image-first chunking prompt used before OCR fallback.
 * This prompt asks the model to find visible sections in the image and return
 * them as chunk objects right away, instead of transcribing the full image text first.
 */
export function buildScanToTaskImageChunkPrompt(fileName: string, instruction = "") {
  return [
    `File name: ${fileName}`,
    instruction.trim() ? `Instruction: ${instruction.trim()}` : null,
    "Look at the image and split it into the smallest useful task chunks you can identify.",
    "Return valid JSON only with keys chunks.",
    "Each chunk must have title and sourceText.",
    "One chunk must become one task.",
    "If the image shows multiple cards, recipes, steps, panels, screenshots, or sections, make each visible section its own chunk.",
    "Keep sourceText short, specific, and close to what is visibly written in that section.",
    "Do not merge separate sections into one chunk.",
    "Do not turn the whole image into one long transcription if it clearly contains multiple parts.",
    "Use a short human-friendly title like 'Recipe 1', 'Step 2', 'Panel A', or the visible heading.",
    "Do not invent content.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildScanToTaskDuplicateAdjudicationPrompt() {
  return [
    "You are deciding whether two task drafts represent the same actionable task.",
    "Return valid JSON only with keys sameTask and reason.",
    "Set sameTask to true only when the new draft should reuse the existing task instead of creating a new one.",
    "Set sameTask to false when the content is only related, adjacent, or about a different task/topic.",
    "Be conservative when the task titles are similar but the actions or outcomes are different.",
  ].join(" ");
}

/**
 * Builds the prompt used to merge a reviewed draft into an existing task.
 * The model should add missing detail, remove repetition, and preserve the
 * existing task's intent unless the new draft is clearly more specific.
 */
export function buildScanToTaskTaskMergePrompt(
  existingTask: {
    name: string;
    description: string | null;
    durationMin: number;
    minPeople: number;
    maxPeople: number | null;
  },
  draft: {
    title: string;
    description: string;
    summary: string;
    sourceText: string;
  },
) {
  return [
    "You are editing an existing task with a new reviewed scan draft.",
    "Return valid JSON only with keys title, description, durationMin, peopleRequired, minWaitDays, and maxWaitDays.",
    "Do not make details up.",
    "Only keep the details that are needed.",
    "Preserve the existing task unless the scan draft clearly adds useful detail.",
    "Add missing detail from the new draft, but do not repeat text that already exists in the task.",
    "If the existing task and the new draft say the same thing, remove the duplicate and keep the clearest version.",
    "Keep the description concise, worker-friendly, and readable as markdown.",
    "Treat the existing task as the baseline and merge the new draft into it.",
    `Existing task:\n${JSON.stringify(existingTask, null, 2)}`,
    `New draft:\n${JSON.stringify(draft, null, 2)}`,
  ].join("\n\n");
}

/**
 * Builds the prompt for merging multiple selected drafts and tasks into one
 * concise draft.
 */
export function buildScanToTaskConflictMergePrompt(input: {
  drafts: Array<{
    title: string;
    description: string;
    summary: string;
    sourceText: string;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    minPeople: number;
    maxPeople: number | null;
  }>;
  instruction?: string;
}) {
  return [
    "You are merging several selected drafts and tasks into one new task draft.",
    "Return valid JSON only with keys title, description, durationMin, peopleRequired, minWaitDays, maxWaitDays, summary, and sourceText.",
    "Do not make details up.",
    "Keep the result concise, precise, and worker-friendly.",
    input.instruction?.trim() ? `User instructions:\n${input.instruction.trim()}` : null,
    "Combine overlapping details only once; remove repeated wording and repeated steps.",
    "If multiple items say the same thing, keep the clearest single version.",
    "Prefer the most specific title that still covers the whole merged set.",
    "If the inputs conflict, choose the safest, most general wording rather than inventing a compromise.",
    "Keep sourceText as a compact merged evidence block rather than a long rewrite.",
    `Selected items:\n${JSON.stringify(input, null, 2)}`,
  ].join("\n\n");
}

export function buildScanToTaskChunkSplitPrompt(
  fileName: string,
  safeSourceText: string,
  instruction = "",
) {
  return [
    "You are splitting one source into atomic task chunks.",
    `File name: ${fileName}`,
    instruction.trim() ? `Instruction: ${instruction.trim()}` : null,
    `Source text:\n${safeSourceText}`,
    "Return valid JSON only with keys chunks.",
    "Each chunk must have title and sourceText.",
    "One chunk must become one task.",
    "If the source contains multiple recipe titles, menu items, or distinct instruction blocks, make each one its own chunk.",
    "Do not merge separate recipes into one chunk just because they share ingredients like buns, cheese, onions, or mustard.",
    "Never combine two recipes, procedures, workflows, or unrelated instruction sets into one chunk.",
    "Split whenever the goal, object, outcome, or required action changes.",
    "Prefer smaller chunks when unsure; do not merge just because two parts are adjacent.",
    "Make 1 chunk when the source already describes one task.",
    "Make 2 to 5 chunks only when the source clearly contains distinct executable tasks.",
    "Keep sourceText as a contiguous excerpt from the source whenever possible. Do not rewrite the text.",
    "Keep each chunk self-contained and avoid duplicating the same text across chunks.",
    "Use short human-friendly titles like 'Recipe', 'Operations', or 'Safety notes'.",
    "Do not invent content.",
  ]
    .filter(Boolean)
    .join("\n\n");
}