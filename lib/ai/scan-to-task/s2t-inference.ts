import OpenAI from "openai";
import { buildTaskSuggestion } from "./task-suggestions";
import { readStorageFile } from "@/lib/platform/supabase-storage";
import {
  buildScanToTaskImageContextCheckPrompt,
  buildScanToTaskSystemPrompt,
  scanToTaskConfig,
} from "./s2t-config";
import {
  filenameToSummary,
  filenameToTitle,
  logScanToTaskModelError,
  logScanToTaskModelInput,
  limitText,
  limitTextPreservingFormatting,
  logScanToTaskModelResponse,
  splitTextIntoChunks,
} from "./s2t-helpers";
import {
  buildScanToTaskImageInstructionPrompt,
  buildScanToTaskImageChunkPrompt,
  buildScanToTaskChunkDraftPrompt,
  buildScanToTaskChunkSplitPrompt,
} from "./s2t-prompts";
import {
  extractTextFromBytes,
  getScanSourceKindForInput,
  normalizeImageBytesForVision,
  toDataUrlFromBytes,
} from "./s2t-input";
import { scanTaskDraftSchema, type ScanTaskDraftInput } from "@/lib/validators/scan-to-task";

export type ScanTaskDraft = ScanTaskDraftInput;

const openAiKey = process.env.OPENAI_API_KEY?.trim();
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const openAiModel = scanToTaskConfig.model;
const scanToTaskDebugLogging = scanToTaskConfig.debugLogging;
const scanToTaskVerboseLogging = scanToTaskConfig.verboseLogging;

type ImageContextCheck = {
  actionable: boolean;
  reason: string;
};

type ChunkSplitSection = {
  title: string;
  sourceText: string;
};

type RawChunkSplitSection = {
  title?: string;
  label?: string;
  sourceText?: string;
};

type ChunkDraftSection = {
  title: string;
  sourceText: string;
  sectionLabel: string;
};

type DraftIdentity = {
  title: string;
  description: string;
  sourceText: string;
};

type RawDraftResponse = {
  title?: string;
  description?: string;
  durationMin?: unknown;
  peopleRequired?: unknown;
  minWaitDays?: unknown;
  maxWaitDays?: unknown;
  summary?: string;
  sourceText?: string;
};

type PreparedImageInput = {
  normalized: {
    bytes: ArrayBuffer;
    mimeType: string;
  };
  imageContextCheck: ImageContextCheck;
};

function parseChunkResponse(content: string) {
  const parsed = JSON.parse(content) as { chunks?: RawChunkSplitSection[] };
  const chunks = parsed.chunks ?? [];

  return chunks
    .map((chunk) => {
      const rawChunk = chunk as Record<string, unknown>;
      const title =
        (typeof rawChunk.title === "string" ? rawChunk.title.trim() : "") ||
        (typeof rawChunk.label === "string" ? rawChunk.label.trim() : "") ||
        "";
      const sourceText = typeof rawChunk.sourceText === "string" ? rawChunk.sourceText.trim() : "";
      return { title, sourceText };
    })
    .filter((section): section is ChunkSplitSection => section.title.length > 0 && section.sourceText.length > 0)
    .slice(0, scanToTaskConfig.chunkSplitMaxChunks);
}

function buildChunkDraftSections(params: {
  useImageChunks: boolean;
  imageChunkSections: ChunkSplitSection[] | null;
  aiChunkSections: ChunkSplitSection[] | null;
  textChunks: string[];
  sourceText: string;
  fileName: string;
}): ChunkDraftSection[] {
  const { useImageChunks, imageChunkSections, aiChunkSections, textChunks, sourceText, fileName } = params;

  if (useImageChunks && imageChunkSections) {
    return imageChunkSections.map((chunk) => ({
      title: chunk.title,
      sourceText: chunk.sourceText,
      sectionLabel: chunk.title,
    }));
  }

  if (aiChunkSections && aiChunkSections.length > 0) {
    return aiChunkSections.map((chunk) => ({
      title: chunk.title,
      sourceText: chunk.sourceText,
      sectionLabel: chunk.title,
    }));
  }

  if (textChunks.length > 0) {
    return textChunks.map((chunk, index) => {
      const sectionLabel = textChunks.length > 1 ? `Part ${index + 1} of ${textChunks.length}` : "";
      return {
        title: sectionLabel || filenameToTitle(fileName),
        sourceText: chunk,
        sectionLabel,
      };
    });
  }

  return [{ title: filenameToTitle(fileName), sourceText, sectionLabel: "" }];
}

/**
 * Coerces a loosely-typed draft response into the schema shape we expect.
 */
function normalizeDraftResponse(content: string) {
  const parsed = JSON.parse(content) as RawDraftResponse;
  const toNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsedNumber = Number(value);
      return Number.isFinite(parsedNumber) ? parsedNumber : null;
    }
    return null;
  };

  return {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    durationMin: toNumber(parsed.durationMin),
    peopleRequired: toNumber(parsed.peopleRequired),
    minWaitDays: toNumber(parsed.minWaitDays),
    maxWaitDays: toNumber(parsed.maxWaitDays),
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    sourceText: typeof parsed.sourceText === "string" ? parsed.sourceText.trim() : "",
  };
}

/**
 * Tries to repair a malformed draft response before falling back.
 */
function repairDraftResponse(content: string) {
  const normalized = normalizeDraftResponse(content);
  return scanTaskDraftSchema.safeParse({
    ...normalized,
    description: limitTextPreservingFormatting(normalized.description, 5000),
    durationMin: normalized.durationMin ?? 30,
    peopleRequired: normalized.peopleRequired ?? 1,
    minWaitDays: normalized.minWaitDays ?? 1,
    maxWaitDays: normalized.maxWaitDays ?? normalized.minWaitDays ?? 1,
    sourceText: limitTextPreservingFormatting(normalized.sourceText || "", scanToTaskConfig.sourceTextMaxLength),
  });
}

function debugScanToTask(context: string, payload: Record<string, unknown>) {
  if (!scanToTaskDebugLogging) return;
  console.debug(`[scan-to-task] ${context}`, payload);
}

function summarizeChunkForLog(chunk: ChunkDraftSection) {
  return {
    sectionLabel: chunk.sectionLabel,
    sourceTextLength: chunk.sourceText.length,
    sourceTextPreview: limitText(chunk.sourceText, 500),
  };
}

function summarizeDraftForLog(draft: ScanTaskDraft, sectionLabel: string) {
  return {
    sectionLabel,
    title: draft.title,
    descriptionPreview: limitText(draft.description, 500),
    sourceTextPreview: limitText(draft.sourceText, 500),
  };
}

function normalizeDraftIdentityPart(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function getDraftIdentity(draft: ScanTaskDraft): DraftIdentity {
  return {
    title: normalizeDraftIdentityPart(draft.title),
    description: normalizeDraftIdentityPart(draft.description),
    sourceText: normalizeDraftIdentityPart(draft.sourceText),
  };
}

function isDuplicateDraft(left: ScanTaskDraft, right: ScanTaskDraft) {
  const leftIdentity = getDraftIdentity(left);
  const rightIdentity = getDraftIdentity(right);
  const sameTitle = leftIdentity.title && leftIdentity.title === rightIdentity.title;
  const sameDescription =
    leftIdentity.description.length > 0 &&
    rightIdentity.description.length > 0 &&
    leftIdentity.description === rightIdentity.description;
  const sameSourceText =
    leftIdentity.sourceText.length > 0 &&
    leftIdentity.sourceText === rightIdentity.sourceText;

  return Boolean((sameTitle && (sameDescription || sameSourceText)) || sameSourceText);
}

function dedupeDrafts(drafts: ScanTaskDraft[]) {
  const uniqueDrafts: ScanTaskDraft[] = [];

  for (const draft of drafts) {
    if (uniqueDrafts.some((existing) => isDuplicateDraft(existing, draft))) {
      continue;
    }
    uniqueDrafts.push(draft);
  }

  return uniqueDrafts;
}

function buildImageContextCheckPrompt() {
  return buildScanToTaskImageContextCheckPrompt();
}

async function checkImageHasTaskContext(
  fileName: string,
  normalized: {
    bytes: ArrayBuffer;
    mimeType: string;
  },
  instruction: string,
) {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  if (!openAiClient || safeInstruction) {
    return { actionable: true, reason: "" } satisfies ImageContextCheck;
  }

  const input = {
    stage: "image-context-check",
    fileName,
    mimeType: normalized.mimeType,
    imageBytes: normalized.bytes.byteLength,
  };

  try {
    logScanToTaskModelInput(scanToTaskDebugLogging, "image-context-check", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.contextCheckTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildImageContextCheckPrompt(),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `File name: ${fileName}`,
            },
            {
              type: "text",
              text: `Mime type: ${normalized.mimeType || "unknown"}`,
            },
            {
              type: "image_url",
              image_url: { url: toDataUrlFromBytes(normalized.bytes, normalized.mimeType) },
            },
          ],
        },
      ],
      }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "image-context-check",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return { actionable: true, reason: "" } satisfies ImageContextCheck;

    const parsed = JSON.parse(content) as Partial<ImageContextCheck>;
    if (typeof parsed.actionable !== "boolean") {
      return { actionable: true, reason: "" } satisfies ImageContextCheck;
    }

    return {
      actionable: parsed.actionable,
      reason: typeof parsed.reason === "string" ? parsed.reason.trim() : "",
    };
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "image-context-check", openAiModel, error, input);
    return { actionable: true, reason: "" } satisfies ImageContextCheck;
  }
}

async function prepareImageInputForExtraction(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction: string,
) {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  const normalized = await normalizeImageBytesForVision(fileName, bytes, mimeType);
  const imageContextCheck = await checkImageHasTaskContext(fileName, normalized, safeInstruction);

  return { normalized, imageContextCheck, safeInstruction };
}

/**
 * Builds a validated fallback draft when AI inference is unavailable or fails.
 * The fallback uses the filename and available text to create a sane task draft.
 */
export function buildFallbackScanTaskDraft(
  fileName: string,
  instruction: string,
  bodyText = "",
  titleSuffix = "",
) {
  const sourceText = [instruction, bodyText].filter(Boolean).join("\n\n");
  const title = `${filenameToTitle(fileName)}${titleSuffix ? ` ${titleSuffix}` : ""}`.slice(0, 200);
  const draft = buildTaskSuggestion({
    title,
    description: instruction || fileName,
    descriptionBody: sourceText,
    sourceText,
    durationMin: 30,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 1,
  });

  return scanTaskDraftSchema.parse({
    ...draft,
    description: draft.description.slice(0, 5000),
    sourceText: sourceText.slice(0, scanToTaskConfig.sourceTextMaxLength),
  });
}

export { getScanFileKind } from "./s2t-input";

async function draftFromTextChunk(
  fileName: string,
  instruction: string,
  sourceText: string,
  sectionLabel = "",
): Promise<ScanTaskDraft> {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  const safeSourceText = limitTextPreservingFormatting(sourceText, scanToTaskConfig.sourceTextMaxLength);
  const labeledFileName = sectionLabel ? `${fileName} (${sectionLabel})` : fileName;

  if (!openAiClient) {
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
  }

  try {
    const input = {
      stage: "text-draft",
      fileName,
      sectionLabel,
      instructionPreview: safeInstruction ? limitText(safeInstruction, 200) : "",
      sourceTextLength: safeSourceText.length,
      sourceTextPreview: limitText(safeSourceText, 200),
    };
    logScanToTaskModelInput(scanToTaskDebugLogging, "text-draft", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.textTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildScanToTaskSystemPrompt("section of the document"),
        },
        {
          role: "user",
          content: [
            safeInstruction
              ? {
                  type: "text",
                  text: `Instruction: ${safeInstruction}`,
                }
              : null,
            {
              type: "text",
              text: buildScanToTaskChunkDraftPrompt(labeledFileName, safeSourceText, sectionLabel),
            },
          ].filter(Boolean) as Array<{ type: "text"; text: string }>,
        },
      ],
      }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "text-draft",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      const repaired = repairDraftResponse(content);
      if (repaired.success) {
        return repaired.data;
      }

      if (scanToTaskDebugLogging) {
        console.debug("[scan-to-task] failed to parse text model response", {
          fileName,
          sectionLabel,
          model: openAiModel,
          issues: parsed.error.issues,
          repairedIssues: repaired.error.issues,
        });
      }

      const retryPrompt = [
        "Repair the JSON below so it matches the exact schema expected by the app.",
        "Return valid JSON only.",
        "title must be short and specific.",
        "description must be markdown text.",
        `Draft JSON:\n${content}`,
      ].join("\n\n");

      const retryResponse = await openAiClient.chat.completions.create({
        model: openAiModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildScanToTaskSystemPrompt("a structured task draft JSON object"),
          },
          {
            role: "user",
            content: [{ type: "text", text: retryPrompt }],
          },
        ],
      }, { timeout: scanToTaskConfig.requestTimeoutMs });

      const retryContent = retryResponse.choices[0]?.message?.content;
      logScanToTaskModelResponse(
        scanToTaskDebugLogging,
        scanToTaskVerboseLogging,
        "text-draft-repair",
        retryResponse.id,
        openAiModel,
        retryContent ?? "",
        retryResponse.usage,
      );
      if (retryContent) {
        const retryParsed = scanTaskDraftSchema.safeParse(JSON.parse(retryContent));
        if (retryParsed.success) {
          return retryParsed.data;
        }
      }

      return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
    }

    return parsed.data;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "text-draft", openAiModel, error, {
      fileName,
      sectionLabel,
      sourceTextLength: safeSourceText.length,
    });
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
  }
}

async function splitImageIntoChunkSections(
  fileName: string,
  prepared: PreparedImageInput,
  instruction: string,
): Promise<ChunkSplitSection[] | null> {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  if (!prepared.imageContextCheck.actionable) {
    throw new Error(
      prepared.imageContextCheck.reason ||
        "This image does not look like a document or instruction. Upload a photo of the relevant document, or add an instruction for how to use it.",
    );
  }

  if (!openAiClient) {
    return null;
  }

  try {
    const imageUrl = toDataUrlFromBytes(prepared.normalized.bytes, prepared.normalized.mimeType);
    const input = {
      stage: "image-chunk-split",
      fileName,
      mimeType: prepared.normalized.mimeType,
      normalizedMimeType: prepared.normalized.mimeType,
      instructionPreview: safeInstruction ? limitText(safeInstruction, 200) : "",
      imageBytes: prepared.normalized.bytes.byteLength,
    };
    logScanToTaskModelInput(scanToTaskDebugLogging, "image-chunk-split", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.chunkSplitTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildScanToTaskSystemPrompt("image section chunking from an uploaded image"),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildScanToTaskImageChunkPrompt(fileName, safeInstruction),
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ].filter(Boolean) as Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
          >,
        },
      ],
    }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "image-chunk-split",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return null;

    const sections = parseChunkResponse(content);
    if (!sections || sections.length === 0) return null;

    return sections;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "image-chunk-split", openAiModel, error, {
      fileName,
      mimeType: prepared.normalized.mimeType,
    });
    return null;
  }
}

async function extractTextFromImage(
  fileName: string,
  prepared: PreparedImageInput,
  instruction: string,
): Promise<string> {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  if (!prepared.imageContextCheck.actionable) {
    throw new Error(
      prepared.imageContextCheck.reason ||
        "This image does not look like a document or instruction. Upload a photo of the relevant document, or add an instruction for how to use it.",
    );
  }

  if (!openAiClient) {
    return "";
  }

  try {
    const imageUrl = toDataUrlFromBytes(prepared.normalized.bytes, prepared.normalized.mimeType);
    const input = {
      stage: "image-ocr",
      fileName,
      mimeType: prepared.normalized.mimeType,
      normalizedMimeType: prepared.normalized.mimeType,
      instructionPreview: safeInstruction ? limitText(safeInstruction, 200) : "",
      imageBytes: prepared.normalized.bytes.byteLength,
    };
    logScanToTaskModelInput(scanToTaskDebugLogging, "image-ocr", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildScanToTaskSystemPrompt("OCR transcription from an uploaded image"),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildScanToTaskImageInstructionPrompt(fileName, safeInstruction),
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ].filter(Boolean) as Array<
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
          >,
        },
      ],
      }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "image-ocr",
      response.id,
      openAiModel,
      content ?? "",
      response.usage,
    );
    if (!content) return "";

    const parsed = JSON.parse(content) as Partial<{ sourceText: string }>;
    if (typeof parsed.sourceText !== "string") {
      logScanToTaskModelError(scanToTaskDebugLogging, "image-ocr-parse", openAiModel, new Error("Missing sourceText"), {
        fileName,
        contentLength: content.length,
      });
      return "";
    }

    const sourceText = parsed.sourceText.trim();
    return sourceText;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "image-ocr", openAiModel, error, {
      fileName,
      mimeType: prepared.normalized.mimeType,
    });
    return "";
  }
}

async function splitTextIntoChunkSections(
  fileName: string,
  instruction: string,
  sourceText: string,
): Promise<ChunkSplitSection[] | null> {
  const safeInstruction = limitText(instruction, scanToTaskConfig.instructionMaxLength);
  const safeSourceText = limitTextPreservingFormatting(sourceText, scanToTaskConfig.sourceTextMaxLength);

  if (!openAiClient) return null;
  if (safeSourceText.length < scanToTaskConfig.chunkSplitMinLength) return null;

  try {
    const prompt = buildScanToTaskChunkSplitPrompt(fileName, safeSourceText, safeInstruction);
    const input = {
      stage: "text-chunk-split",
      fileName,
      instructionPreview: safeInstruction ? limitText(safeInstruction, 200) : "",
      sourceTextLength: safeSourceText.length,
      sourceTextPreview: limitText(safeSourceText, 200),
    };
    logScanToTaskModelInput(scanToTaskDebugLogging, "text-chunk-split", openAiModel, input);

    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.chunkSplitTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt.system,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt.user,
            },
          ],
        },
      ],
      }, { timeout: scanToTaskConfig.requestTimeoutMs });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    logScanToTaskModelResponse(
      scanToTaskDebugLogging,
      scanToTaskVerboseLogging,
      "text-chunk-split",
      response.id,
      openAiModel,
      content,
      response.usage,
    );

    const sections = parseChunkResponse(content);

    if (!sections || sections.length === 0) return null;

    return sections;
  } catch (error) {
    logScanToTaskModelError(scanToTaskDebugLogging, "text-chunk-split", openAiModel, error, {
      fileName,
      sourceTextLength: safeSourceText.length,
    });
    return null;
  }
}

export async function inferScanTaskDraftsFromBytes(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction = "",
): Promise<ScanTaskDraft[]> {
  const kind = getScanSourceKindForInput(fileName, mimeType);

  const preparedImageInput = kind === "image"
    ? await prepareImageInputForExtraction(fileName, mimeType, bytes, instruction)
    : null;

  const imageChunkSections = preparedImageInput
    ? await splitImageIntoChunkSections(fileName, preparedImageInput, instruction)
    : null;

  const useImageChunks = imageChunkSections !== null && imageChunkSections.length > 0;

  const extractedText = kind === "image"
    ? useImageChunks
      ? ""
      : await extractTextFromImage(fileName, preparedImageInput!, instruction)
    : await extractTextFromBytes(bytes, kind);

  const sourceText = extractedText || filenameToSummary(fileName);
  const aiChunkSections = useImageChunks ? null : await splitTextIntoChunkSections(fileName, instruction, sourceText);
  const textChunks = splitTextIntoChunks(sourceText, scanToTaskConfig.chunkMaxLength, scanToTaskConfig.maxChunks);
  const chunksToUse = buildChunkDraftSections({
    useImageChunks,
    imageChunkSections,
    aiChunkSections,
    textChunks,
    sourceText,
    fileName,
  });

  debugScanToTask("chunk plan", {
    fileName,
    kind,
    imageChunkCount: imageChunkSections?.length ?? 0,
    verboseLogging: scanToTaskVerboseLogging,
    extractedTextLength: extractedText.length,
    extractedTextPreview: limitText(extractedText || sourceText, 1000),
    sourceTextLength: sourceText.length,
    sourceTextPreview: limitText(sourceText, 1000),
    chunkSource: useImageChunks
      ? "image-split"
      : aiChunkSections && aiChunkSections.length > 0
        ? "ai-split"
        : textChunks.length > 0
          ? "length-split"
          : "single",
    chunkCount: chunksToUse.length,
    chunks: chunksToUse.map(summarizeChunkForLog),
  });

  const drafts: ScanTaskDraft[] = new Array(chunksToUse.length);
  const workerCount = Math.min(3, chunksToUse.length);
  let nextChunkIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextChunkIndex < chunksToUse.length) {
        const currentIndex = nextChunkIndex;
        nextChunkIndex += 1;
        const { sourceText: chunk, sectionLabel } = chunksToUse[currentIndex];
        drafts[currentIndex] = await draftFromTextChunk(fileName, instruction, chunk, sectionLabel);
      }
    }),
  );

  debugScanToTask("draft batch complete", {
    fileName,
    kind,
    draftCount: drafts.length,
    drafts: drafts.map((draft, index) => summarizeDraftForLog(draft, chunksToUse[index]?.sectionLabel ?? "")),
  });

  const uniqueDrafts = dedupeDrafts(drafts);

  if (uniqueDrafts.length !== drafts.length) {
    debugScanToTask("duplicate drafts removed", {
      fileName,
      kind,
      removedCount: drafts.length - uniqueDrafts.length,
      keptCount: uniqueDrafts.length,
    });
  }

  return uniqueDrafts;
}

export async function inferScanTaskDraft(file: File, instruction = "") {
  const drafts = await inferScanTaskDraftsFromBytes(
    file.name,
    file.type,
    await file.arrayBuffer(),
    instruction,
  );
  return drafts[0] ?? buildFallbackScanTaskDraft(file.name, instruction, file.name);
}

export async function inferScanTaskDrafts(file: File, instruction = "") {
  return inferScanTaskDraftsFromBytes(
    file.name,
    file.type,
    await file.arrayBuffer(),
    instruction,
  );
}

export async function inferScanTaskDraftFromStorage(
  storagePath: string,
  fileName: string,
  mimeType: string,
  instruction = "",
) {
  const drafts = await inferScanTaskDraftsFromStorage(storagePath, fileName, mimeType, instruction);
  return drafts[0] ?? buildFallbackScanTaskDraft(fileName, instruction, fileName);
}

export async function inferScanTaskDraftsFromStorage(
  storagePath: string,
  fileName: string,
  mimeType: string,
  instruction = "",
) {
  const result = await readStorageFile(storagePath);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return inferScanTaskDraftsFromBytes(fileName, mimeType, result.arrayBuffer, instruction);
}