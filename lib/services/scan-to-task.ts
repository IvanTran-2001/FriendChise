import { getScanSourceKind } from "@/lib/ai/scan-to-task";
import { deleteStorageFile } from "@/lib/platform/supabase-storage";

export const MAX_FILES = 12;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const SCAN_UPLOAD_PREFIX = "scan-to-task";

/**
 * Normalizes the optional instruction text from a form submission.
 * Blank or non-string values collapse to an empty string so downstream
 * scan behavior can treat them as no instruction.
 */
export function normalizeInstruction(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Produces a stable accent color from a string seed.
 * The deterministic palette keeps confirmed tasks visually consistent.
 */
export function colorFromSeed(seed: string) {
  const palette = [
    "#0EA5E9",
    "#14B8A6",
    "#22C55E",
    "#F59E0B",
    "#F97316",
    "#EC4899",
    "#8B5CF6",
    "#6366F1",
  ];
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

/**
 * Builds a temporary org-scoped storage path for a file staged before scanning.
 * The file extension is inferred from the file kind so the scanner can preserve
 * enough type information when reading the object back.
 */
export function buildTempUploadPath(orgId: string, fileName: string, mimeType: string) {
  const kind = getScanSourceKind(fileName, mimeType);
  const extByKind: Record<string, string> = {
    image: mimeType.split("/")[1] || "png",
    pdf: "pdf",
    docx: "docx",
    text: fileName.toLowerCase().endsWith(".md")
      ? "md"
      : fileName.toLowerCase().endsWith(".csv")
        ? "csv"
        : fileName.toLowerCase().endsWith(".json")
          ? "json"
          : fileName.toLowerCase().endsWith(".xml")
            ? "xml"
            : "txt",
    unknown: "bin",
  };
  const ext = extByKind[kind] ?? "bin";
  return `orgs/${orgId}/${SCAN_UPLOAD_PREFIX}/${crypto.randomUUID()}.${ext}`;
}

/**
 * Best-effort cleanup for temporary uploads.
 * Failures are swallowed because cleanup should not block the user-facing flow.
 */
export async function cleanupUploads(storagePaths: string[]) {
  await Promise.allSettled(storagePaths.map((storagePath) => deleteStorageFile(storagePath)));
}
