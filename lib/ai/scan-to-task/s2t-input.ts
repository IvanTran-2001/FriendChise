import sharp from "sharp";
import mammoth from "mammoth";
import { buildSourceSummary, limitText } from "./s2t-helpers";
import { getScanSourceKind, resolveScanUploadMimeType } from "@/lib/services/scan-to-task-shared";

export type ScanFileKind = "image" | "pdf" | "docx" | "text" | "unknown";

export class ScanToTaskUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanToTaskUserFacingError";
  }
}

/**
 * Reuses the shared source classifier for file-like inputs.
 */
export function getScanSourceKindForInput(fileName: string, mimeType = ""): ScanFileKind {
  return getScanSourceKind(fileName, mimeType);
}

/**
 * Reuses the shared source classifier for in-memory File objects.
 */
export function getScanFileKind(file: File): ScanFileKind {
  return getScanSourceKindForInput(file.name, file.type);
}

/**
 * Encodes raw bytes as a data URL so image uploads can be sent to the model.
 */
export function toDataUrlFromBytes(
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
export async function normalizeImageBytesForVision(
  fileName: string,
  bytes: ArrayBuffer,
  mimeType: string,
) {
  const resolvedMimeType = resolveScanUploadMimeType(fileName, mimeType).toLowerCase();
  if (resolvedMimeType !== "image/heic" && resolvedMimeType !== "image/heif") {
    return { bytes, mimeType: resolvedMimeType || "image/png" };
  }

  let converted: Buffer;
  try {
    converted = await sharp(Buffer.from(bytes)).png().toBuffer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // libheif rejects HEIC/HEIF files with unusually many embedded item
    // references (common on Portrait mode, Live Photos, or burst shots) as a
    // decompression-bomb safeguard, surfacing a cryptic "iref box" error.
    if (message.includes("security limit exceeded")) {
      throw new ScanToTaskUserFacingError(
        "This photo couldn't be processed because of how your phone saved it. Photos taken with Portrait mode, Live Photos, or burst mode pack in extra hidden data (like depth maps and preview frames) that our image processor refuses to open as a safety precaution. Please try again with a plain, single photo (not Portrait/Live), or switch your iPhone's camera format to \"Most Compatible\" (JPEG) in Settings > Camera > Formats so future photos avoid this issue entirely.",
      );
    }
    throw error;
  }

  return {
    bytes: converted.buffer.slice(
      converted.byteOffset,
      converted.byteOffset + converted.byteLength,
    ) as ArrayBuffer,
    mimeType: "image/png",
  };
}

/**
 * Extracts plain text from PDF, DOCX, or text-like byte content.
 * Image files are handled separately, so they return an empty string here.
 */
export async function extractTextFromBytes(bytes: ArrayBuffer, kind: ScanFileKind) {
  if (kind === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        return result.text ?? "";
      } catch {
        return "";
      } finally {
        try {
          await parser.destroy();
        } catch {
          // Ignore cleanup failures after extraction has already completed.
        }
      }
    } catch {
      return "";
    }
  }

  if (kind === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return result.value ?? "";
    } catch {
      return "";
    }
  }

  if (kind === "text") {
    return Buffer.from(bytes).toString("utf8");
  }

  return "";
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
export function getScanSourceSummary(
  fileName: string,
  mimeType = "",
  instruction = "",
) {
  return buildSourceSummary(fileName, getScanSourceKindForInput(fileName, mimeType), instruction);
}

/**
 * Builds a lightweight prompt summary for logging and debugging.
 */
export function getScanInputSummary(fileName: string, mimeType = "", instruction = "") {
  return buildSourceSummary(fileName, getScanSourceKindForInput(fileName, mimeType), limitText(instruction, 500));
}