import OpenAI from "openai";
import sharp from "sharp";
import mammoth from "mammoth";
import { buildTaskSuggestion } from "@/lib/ai/task-suggestions";
import { readStorageFile } from "@/lib/platform/supabase-storage";
import {
  buildScanToTaskImageContextCheckPrompt,
  buildScanToTaskSystemPrompt,
  scanToTaskConfig,
} from "@/lib/ai/scan-to-task-config";
import {
  getScanSourceKind,
  resolveScanUploadMimeType,
} from "@/lib/services/scan-to-task-shared";
import { scanTaskDraftSchema, type ScanTaskDraftInput } from "@/lib/validators/scan-to-task";

export type ScanFileKind = "image" | "pdf" | "docx" | "text" | "unknown";

export type ScanTaskDraft = ScanTaskDraftInput;

const openAiKey = process.env.OPENAI_API_KEY?.trim();
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const openAiModel = scanToTaskConfig.model;
const scanToTaskDebugLogging = scanToTaskConfig.debugLogging;

/**
 * Collapses repeated whitespace so extracted text and prompts stay compact
 * and easier for the model to parse.
 */
function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Converts a sluggy or underscored string into a title-cased label.
 */
function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Derives a readable fallback task title from a source filename.
 */
function filenameToTitle(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = cleanText(base.replace(/[._-]+/g, " "));
  return cleaned ? titleCase(cleaned) : "New task";
}

/**
 * Builds a short summary for non-image sources when no extracted text exists.
 */
function filenameToSummary(fileName: string) {
  return `Imported from ${fileName}.`;
}

/**
 * Limits prompt text so we do not send excessively large inputs to the model.
 */
function limitText(value: string, maxLength = 12000) {
  const cleaned = cleanText(value);
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

function logScanToTaskModelResponse(
  context: string,
  responseId: string | undefined,
  content: string,
) {
  if (!scanToTaskDebugLogging) return;
  console.debug("[scan-to-task] model response", {
    context,
    responseId,
    model: openAiModel,
    content,
  });
}

type ImageContextCheck = {
  actionable: boolean;
  reason: string;
};

function buildImageContextCheckPrompt() {
  return buildScanToTaskImageContextCheckPrompt();
}

async function checkImageHasTaskContext(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction: string,
) {
  const safeInstruction = limitText(instruction, 1000);
  if (!openAiClient || safeInstruction) {
    return { actionable: true } satisfies Pick<ImageContextCheck, "actionable">;
  }

  const normalized = await normalizeImageBytesForVision(fileName, bytes, mimeType);

  try {
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
              text: `Mime type: ${mimeType || "unknown"}`,
            },
            {
              type: "image_url",
              image_url: { url: toDataUrlFromBytes(normalized.bytes, normalized.mimeType) },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { actionable: true } satisfies Pick<ImageContextCheck, "actionable">;

    const parsed = JSON.parse(content) as Partial<ImageContextCheck>;
    if (typeof parsed.actionable !== "boolean") {
      return { actionable: true } satisfies Pick<ImageContextCheck, "actionable">;
    }

    return {
      actionable: parsed.actionable,
      reason: typeof parsed.reason === "string" ? parsed.reason.trim() : "",
    };
  } catch {
    return { actionable: true } satisfies Pick<ImageContextCheck, "actionable">;
  }
}

/**
 * Splits long source text into smaller chunks so a large document can become
 * multiple drafts instead of one oversized task.
 */
function splitTextIntoChunks(value: string, maxChunkLength = 4000, maxChunks = 5) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentChunk = "";

  const pushCurrentChunk = () => {
    if (!currentChunk) return;
    chunks.push(currentChunk);
    currentChunk = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkLength) {
      pushCurrentChunk();

      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (!sentenceChunk) {
          sentenceChunk = sentence;
          continue;
        }

        if (sentenceChunk.length + sentence.length + 1 <= maxChunkLength) {
          sentenceChunk += ` ${sentence}`;
        } else {
          chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk) {
        chunks.push(sentenceChunk);
      }
      continue;
    }

    if (!currentChunk) {
      currentChunk = paragraph;
      continue;
    }

    if (currentChunk.length + paragraph.length + 2 <= maxChunkLength) {
      currentChunk += `\n\n${paragraph}`;
    } else {
      pushCurrentChunk();
      currentChunk = paragraph;
    }
  }

  pushCurrentChunk();

  while (chunks.length > maxChunks) {
    const tail = chunks.pop();
    if (!tail) continue;
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n\n${tail}`;
  }

  return chunks;
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
  const draft = buildTaskSuggestion({
    title: `${filenameToTitle(fileName)}${titleSuffix ? ` ${titleSuffix}` : ""}`,
    description: sourceText || fileName,
    durationMin: 30,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 1,
  });

  return scanTaskDraftSchema.parse(draft);
}

/**
 * Encodes raw bytes as a data URL so image uploads can be sent to the model.
 */
function toDataUrlFromBytes(
  bytes: ArrayBuffer,
  mimeType = "application/octet-stream",
) {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Normalizes HEIC/HEIF image bytes to PNG so the vision model can read them.
 * Falls back to the file extension when the given MIME type is missing or
 * generic (e.g. `application/octet-stream`), since several browsers/OSes
 * report an empty type for HEIC/HEIF photos.
 */
async function normalizeImageBytesForVision(
  fileName: string,
  bytes: ArrayBuffer,
  mimeType: string,
) {
  const resolvedMimeType = resolveScanUploadMimeType(fileName, mimeType).toLowerCase();
  if (resolvedMimeType !== "image/heic" && resolvedMimeType !== "image/heif") {
    return { bytes, mimeType: mimeType || "image/png" };
  }

  const converted = await sharp(Buffer.from(bytes)).png().toBuffer();
  return {
    bytes: converted.buffer.slice(
      converted.byteOffset,
      converted.byteOffset + converted.byteLength,
    ),
    mimeType: "image/png",
  };
}

/**
 * Reuses the file kind classifier for in-memory File objects.
 */
export function getScanFileKind(file: File): ScanFileKind {
  return getScanSourceKind(file.name, file.type);
}

/**
 * Extracts plain text from PDF, DOCX, or text-like byte content.
 * Image files are handled separately, so they return an empty string here.
 */
async function extractTextFromBytes(bytes: ArrayBuffer, kind: ScanFileKind) {
  if (kind === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } catch {
      return "";
    } finally {
      await parser.destroy();
    }
  }

  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value ?? "";
  }

  if (kind === "text" || kind === "unknown") {
    return Buffer.from(bytes).toString("utf8");
  }

  return "";
}

/**
 * Generates a draft from extracted text by asking the model for structured JSON.
 * Falls back to deterministic draft generation whenever parsing or inference fails.
 */
async function draftFromTextChunk(
  fileName: string,
  instruction: string,
  sourceText: string,
  sectionLabel = "",
): Promise<ScanTaskDraft> {
  const safeInstruction = limitText(instruction, 2000);
  const safeSourceText = limitText(sourceText, scanToTaskConfig.sourceTextMaxLength);
  const labeledFileName = sectionLabel ? `${fileName} (${sectionLabel})` : fileName;

  if (!openAiClient) {
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
  }

  try {
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
              text: [
                `File name: ${labeledFileName}`,
                sectionLabel ? `Section: ${sectionLabel}` : null,
                `Extracted content:\n${safeSourceText || "(none)"}`,
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ].filter(Boolean) as Array<{ type: "text"; text: string }>,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      logScanToTaskModelResponse("text", response.id, content);
    }
    if (!content) return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      if (scanToTaskDebugLogging) {
        console.debug("[scan-to-task] failed to parse text model response", {
          fileName,
          sectionLabel,
          model: openAiModel,
          issues: parsed.error.issues,
        });
      }
      return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
    }

    return parsed.data;
  } catch (error) {
    if (scanToTaskDebugLogging) {
      console.debug("[scan-to-task] text inference failed", {
        fileName,
        sectionLabel,
        model: openAiModel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText, sectionLabel);
  }
}

/**
 * Generates a draft directly from an image upload using the vision-capable model.
 * The model receives the image as a data URL plus the optional instruction text.
 */
async function draftFromImage(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction: string,
): Promise<ScanTaskDraft> {
  const safeInstruction = limitText(instruction, 2000);
  const normalized = await normalizeImageBytesForVision(fileName, bytes, mimeType);

  const imageContextCheck = await checkImageHasTaskContext(
    fileName,
    normalized.mimeType,
    normalized.bytes,
    safeInstruction,
  );
  if (!imageContextCheck.actionable) {
    throw new Error(
      imageContextCheck.reason ||
        "This image does not look like a document or instruction. Upload a photo of the relevant document, or add an instruction for how to use it.",
    );
  }

  if (!openAiClient) {
    return buildFallbackScanTaskDraft(fileName, safeInstruction);
  }

  try {
    const imageUrl = toDataUrlFromBytes(normalized.bytes, normalized.mimeType);
    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: scanToTaskConfig.imageTemperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildScanToTaskSystemPrompt("uploaded image"),
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
              text: `File name: ${fileName}`,
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
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      logScanToTaskModelResponse("image", response.id, content);
    }
    if (!content) return buildFallbackScanTaskDraft(fileName, safeInstruction);

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      if (scanToTaskDebugLogging) {
        console.debug("[scan-to-task] failed to parse image model response", {
          fileName,
          model: openAiModel,
          issues: parsed.error.issues,
        });
      }
      return buildFallbackScanTaskDraft(fileName, safeInstruction);
    }

    return parsed.data;
  } catch (error) {
    if (scanToTaskDebugLogging) {
      console.debug("[scan-to-task] image inference failed", {
        fileName,
        model: openAiModel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return buildFallbackScanTaskDraft(fileName, safeInstruction);
  }
}

/**
 * Routes bytes to the right draft generator based on the file kind.
 * Text-like files are extracted first; images are sent to the vision flow.
 */
async function inferScanTaskDraftsFromBytes(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction = "",
) : Promise<ScanTaskDraft[]> {
  const kind = getScanSourceKind(fileName, mimeType);
  if (kind === "image") {
    return [await draftFromImage(fileName, mimeType, bytes, instruction)];
  }

  const extractedText = await extractTextFromBytes(bytes, kind);
  const sourceText = extractedText || filenameToSummary(fileName);
  const textChunks = splitTextIntoChunks(sourceText);
  const chunksToUse = textChunks.length > 0 ? textChunks : [sourceText];

  const drafts: ScanTaskDraft[] = [];
  for (const [index, chunk] of chunksToUse.entries()) {
    drafts.push(
      await draftFromTextChunk(
        fileName,
        instruction,
        chunk,
        chunksToUse.length > 1 ? `Part ${index + 1} of ${chunksToUse.length}` : "",
      ),
    );
  }

  return drafts;
}

/**
 * Reads a local File and infers a structured task draft from it.
 */
export async function inferScanTaskDraft(file: File, instruction = "") {
  const drafts = await inferScanTaskDraftsFromBytes(
    file.name,
    file.type,
    await file.arrayBuffer(),
    instruction,
  );
  return drafts[0] ?? buildFallbackScanTaskDraft(file.name, instruction, file.name);
}

/**
 * Reads a local File and infers one or more structured task drafts from it.
 */
export async function inferScanTaskDrafts(file: File, instruction = "") {
  return inferScanTaskDraftsFromBytes(
    file.name,
    file.type,
    await file.arrayBuffer(),
    instruction,
  );
}

/**
 * Reads an uploaded object from storage and infers a structured task draft.
 */
export async function inferScanTaskDraftFromStorage(
  storagePath: string,
  fileName: string,
  mimeType: string,
  instruction = "",
) {
  const drafts = await inferScanTaskDraftsFromStorage(storagePath, fileName, mimeType, instruction);
  return drafts[0] ?? buildFallbackScanTaskDraft(fileName, instruction, fileName);
}

/**
 * Reads an uploaded object from storage and infers one or more structured task drafts from it.
 */
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

/**
 * Builds a human-readable summary of a File for prompt/debug usage.
 */
export function getFileSourceSummary(file: File, instruction = "") {
  return buildSourceSummary(file.name, getScanFileKind(file), instruction);
}

/**
 * Builds a human-readable summary of a storage-backed file source.
 */
function buildSourceSummary(fileName: string, kind: ScanFileKind, instruction: string) {
  const chunks = [
    `File: ${fileName}`,
    `Type: ${kind}`,
    instruction.trim() ? `Instruction: ${limitText(instruction, 500)}` : null,
  ].filter(Boolean);
  return chunks.join("\n");
}

/**
 * Builds a human-readable summary of a storage-backed file source.
 */
export function getScanSourceSummary(
  fileName: string,
  mimeType = "",
  instruction = "",
) {
  return buildSourceSummary(fileName, getScanSourceKind(fileName, mimeType), instruction);
}