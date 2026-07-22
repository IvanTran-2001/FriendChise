export const SCAN_TO_TASK_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export const SCAN_TO_TASK_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

export const SCAN_TO_TASK_UPLOAD_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/*";

export type ScanFileKind = "image" | "pdf" | "docx" | "text" | "unknown";

const SCAN_TO_TASK_EXTENSION_MIME_TYPES: Record<string, string> = {
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Resolves the effective MIME type for a scan upload, falling back to the
 * file extension whenever the browser reports a missing or generic type.
 *
 * Many browsers/OSes report an empty `file.type` (or `application/octet-stream`)
 * for HEIC/HEIF photos since those formats aren't in their built-in sniffing
 * tables. Without this fallback, the real type is lost by the time the file
 * reaches the AI vision step, which only converts HEIC/HEIF when it sees the
 * literal MIME string — so the raw (unconverted) bytes get sent to the model
 * mislabeled and the scan silently fails.
 */
export function resolveScanUploadMimeType(fileName: string, mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  const isGeneric = !normalized || normalized === "application/octet-stream";
  if (!isGeneric) return mimeType;

  const lowerName = fileName.toLowerCase();
  const ext = lowerName.slice(lowerName.lastIndexOf("."));
  return SCAN_TO_TASK_EXTENSION_MIME_TYPES[ext] ?? mimeType;
}

/**
 * Classifies a file name and mime type into a coarse source kind used by the
 * scan pipeline.
 */
export function getScanSourceKind(fileName: string, mimeType = ""): ScanFileKind {
  const normalizedName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();
  const normalizedExt = normalizedName.slice(normalizedName.lastIndexOf("."));

  if (
    SCAN_TO_TASK_IMAGE_MIME_TYPES.has(normalizedMime) ||
    normalizedMime.startsWith("image/") ||
    SCAN_TO_TASK_IMAGE_EXTENSIONS.has(normalizedExt)
  ) {
    return "image";
  }
  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) return "pdf";
  if (
    normalizedName.endsWith(".docx") ||
    normalizedMime.includes("wordprocessingml.document")
  ) {
    return "docx";
  }
  if (
    normalizedMime === "text/plain" ||
    normalizedMime === "text/markdown" ||
    normalizedMime === "text/csv" ||
    normalizedMime === "application/json" ||
    normalizedMime === "application/xml" ||
    normalizedMime === "text/xml" ||
    normalizedName.endsWith(".txt") ||
    normalizedName.endsWith(".md") ||
    normalizedName.endsWith(".csv") ||
    normalizedName.endsWith(".json") ||
    normalizedName.endsWith(".xml")
  ) {
    return "text";
  }
  return "unknown";
}

/**
 * Normalizes the MIME type used for the direct storage upload request.
 * Passes the resolved MIME type through as-is so the Supabase Storage bucket's
 * allowed-mime-type policy (which is configured per format, e.g. `image/heic`)
 * can validate the upload correctly. Falls back to a generic type only when
 * no MIME type is available at all.
 */
export function getScanToTaskUploadContentType(mimeType: string) {
  return mimeType || "application/octet-stream";
}

/**
 * Formats a byte count for display in upload and result summaries.
 */
export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}