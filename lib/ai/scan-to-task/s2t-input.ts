import sharp from "sharp";
import mammoth from "mammoth";
import { buildSourceSummary, limitText } from "./s2t-helpers";
import { getScanSourceKind, resolveScanUploadMimeType } from "@/lib/services/scan-to-task-shared";

export type ScanFileKind = "image" | "pdf" | "docx" | "text" | "unknown";

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
    return { bytes, mimeType: resolvedMimeType };
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
 * Extracts plain text from PDF, DOCX, or text-like byte content.
 * Image files are handled separately, so they return an empty string here.
 */
export async function extractTextFromBytes(bytes: ArrayBuffer, kind: ScanFileKind) {
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

  if (kind === "text") {
    return Buffer.from(bytes).toString("utf8");
  }

  if (kind === "unknown") {
    return "";
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