"use client";

/**
 * Hook for uploading an image to embed in a markdown field.
 *
 * Reuses the org image library (same private-bucket path convention as the
 * task/tool item image library) so uploaded images can also be reused
 * elsewhere in the org — see app/actions/storage.ts.
 *
 * Flow:
 *  1. Validate MIME type (jpeg / png / webp) and raw size (≤ 5 MB)
 *  2. Compress with browser-image-compression (max 1 MB / 1280 px)
 *  3. Get a signed upload URL and PUT the compressed file to it
 *  4. Save the path to the org image library, getting back a signed read
 *     URL for immediate preview
 */

import { useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import {
  getSignedOrgImageUploadUrl,
  saveOrgImageToLibrary,
} from "@/app/actions/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_MB = 5;

export function useMarkdownImageUpload(orgId: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * Compresses and uploads a file. Calls `onSuccess` with the storage path
   * (to embed in markdown) once the upload is saved to the library.
   */
  const upload = (
    file: File,
    onSuccess: (storagePath: string) => void,
    onError?: () => void,
  ) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, and WebP images are supported.");
      onError?.();
      return;
    }
    if (file.size > MAX_RAW_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_RAW_MB} MB.`);
      onError?.();
      return;
    }

    startTransition(async () => {
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
          fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
        });

        const urlResult = await getSignedOrgImageUploadUrl(orgId, compressed.type);
        if (!urlResult.ok) {
          setError(urlResult.error);
          onError?.();
          return;
        }

        const uploadRes = await fetch(urlResult.signedUrl, {
          method: "PUT",
          body: compressed,
          headers: { "Content-Type": compressed.type },
        });
        if (!uploadRes.ok) {
          setError("Upload failed. Please try again.");
          onError?.();
          return;
        }

        const saveResult = await saveOrgImageToLibrary(orgId, urlResult.path, file.name);
        if (!saveResult.ok) {
          setError(saveResult.error);
          onError?.();
          return;
        }

        onSuccess(saveResult.image.storagePath);
      } catch {
        setError("An unexpected error occurred. Please try again.");
        onError?.();
      }
    });
  };

  return { upload, isPending, error };
}
