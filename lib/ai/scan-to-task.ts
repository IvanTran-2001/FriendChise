import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { z } from "zod";
import { buildTaskSuggestion } from "@/lib/ai/task-suggestions";
import { readStorageFile } from "@/lib/platform/supabase-storage";

export type ScanFileKind = "image" | "pdf" | "docx" | "text" | "unknown";

export type ScanTaskDraft = {
  title: string;
  description: string;
  durationMin: number;
  peopleRequired: number;
  minWaitDays: number;
  maxWaitDays: number;
  summary: string;
};

const scanTaskDraftSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  durationMin: z.number().int().positive().max(24 * 60),
  peopleRequired: z.number().int().min(1).max(50),
  minWaitDays: z.number().int().min(0).max(3650),
  maxWaitDays: z.number().int().min(0).max(3650),
  summary: z.string().max(500),
});

const openAiKey = process.env.OPENAI_API_KEY?.trim();
const openAiClient = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;
const openAiModel = process.env.OPENAI_SCAN_MODEL ?? "gpt-4.1-mini";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
]);

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function filenameToTitle(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = cleanText(base.replace(/[._-]+/g, " "));
  return cleaned ? titleCase(cleaned) : "New task";
}

function filenameToSummary(fileName: string) {
  return `Imported from ${fileName}.`;
}

function limitText(value: string, maxLength = 12000) {
  const cleaned = cleanText(value);
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}…` : cleaned;
}

export function getScanSourceKind(fileName: string, mimeType = ""): ScanFileKind {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();

  if (IMAGE_TYPES.has(normalizedMime) || normalizedMime.startsWith("image/")) return "image";
  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) return "pdf";
  if (
    normalizedName.endsWith(".docx") ||
    normalizedMime.includes("wordprocessingml.document")
  ) {
    return "docx";
  }
  if (
    TEXT_TYPES.has(normalizedMime) ||
    normalizedName.endsWith(".txt") ||
    normalizedName.endsWith(".md")
  ) {
    return "text";
  }
  return "unknown";
}

export function buildFallbackScanTaskDraft(
  fileName: string,
  instruction: string,
  bodyText = "",
) {
  const sourceText = [instruction, bodyText].filter(Boolean).join("\n\n");
  const draft = buildTaskSuggestion({
    title: filenameToTitle(fileName),
    description: sourceText || fileName,
    durationMin: 30,
    peopleRequired: 1,
    minWaitDays: 1,
    maxWaitDays: 1,
  });

  return scanTaskDraftSchema.parse(draft);
}

function toDataUrlFromBytes(
  bytes: ArrayBuffer,
  mimeType = "application/octet-stream",
) {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export function getScanFileKind(file: File): ScanFileKind {
  return getScanSourceKind(file.name, file.type);
}

async function extractTextFromBytes(bytes: ArrayBuffer, kind: ScanFileKind) {
  if (kind === "pdf") {
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    return cleanText(result.text ?? "");
  }

  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return cleanText(result.value ?? "");
  }

  if (kind === "text" || kind === "unknown") {
    return cleanText(Buffer.from(bytes).toString("utf8"));
  }

  return "";
}

async function draftFromText(
  fileName: string,
  instruction: string,
  sourceText: string,
): Promise<ScanTaskDraft> {
  const safeInstruction = limitText(instruction, 2000);
  const safeSourceText = limitText(sourceText, 12000);

  if (!openAiClient) {
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText);
  }

  try {
    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Scan to Task. Convert the document into one practical task item. Return valid JSON only with keys title, description, durationMin, peopleRequired, minWaitDays, maxWaitDays, summary. Be conservative, concise, and make the task actionable.",
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
              text: `File name: ${fileName}\n\nExtracted content:\n${safeSourceText || "(none)"}`,
            },
          ].filter(Boolean) as Array<{ type: "text"; text: string }>,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText);

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText);

    return parsed.data;
  } catch {
    return buildFallbackScanTaskDraft(fileName, safeInstruction, safeSourceText);
  }
}

async function draftFromImage(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction: string,
): Promise<ScanTaskDraft> {
  const safeInstruction = limitText(instruction, 2000);

  if (!openAiClient) {
    return buildFallbackScanTaskDraft(fileName, safeInstruction);
  }

  try {
    const imageUrl = toDataUrlFromBytes(bytes, mimeType || "image/png");
    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Scan to Task. Convert the uploaded image into one practical task item. Return valid JSON only with keys title, description, durationMin, peopleRequired, minWaitDays, maxWaitDays, summary. Be conservative, concise, and make the task actionable.",
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
    if (!content) return buildFallbackScanTaskDraft(fileName, safeInstruction);

    const parsed = scanTaskDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return buildFallbackScanTaskDraft(fileName, safeInstruction);

    return parsed.data;
  } catch {
    return buildFallbackScanTaskDraft(fileName, safeInstruction);
  }
}

async function inferScanTaskDraftFromBytes(
  fileName: string,
  mimeType: string,
  bytes: ArrayBuffer,
  instruction = "",
) {
  const kind = getScanSourceKind(fileName, mimeType);
  if (kind === "image") {
    return draftFromImage(fileName, mimeType, bytes, instruction);
  }

  const extractedText = await extractTextFromBytes(bytes, kind);
  return draftFromText(
    fileName,
    instruction,
    extractedText || filenameToSummary(fileName),
  );
}

export async function inferScanTaskDraft(file: File, instruction = "") {
  return inferScanTaskDraftFromBytes(
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
  const result = await readStorageFile(storagePath);
  if (!result.ok) {
    throw new Error(result.error);
  }

  return inferScanTaskDraftFromBytes(fileName, mimeType, result.arrayBuffer, instruction);
}

export function getFileSourceSummary(file: File, instruction = "") {
  const kind = getScanFileKind(file);
  const chunks = [
    `File: ${file.name}`,
    `Type: ${kind}`,
    instruction.trim() ? `Instruction: ${limitText(instruction, 500)}` : null,
  ].filter(Boolean);
  return chunks.join("\n");
}

export function getScanSourceSummary(
  fileName: string,
  mimeType = "",
  instruction = "",
) {
  const kind = getScanSourceKind(fileName, mimeType);
  const chunks = [
    `File: ${fileName}`,
    `Type: ${kind}`,
    instruction.trim() ? `Instruction: ${limitText(instruction, 500)}` : null,
  ].filter(Boolean);
  return chunks.join("\n");
}