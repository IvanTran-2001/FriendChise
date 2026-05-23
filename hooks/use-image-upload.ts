"use client";

/**
 * Hook for uploading a task image via Supabase Storage.
 *
 * Flow:
 *  1. Validate MIME type (jpeg / png / webp) and raw size (≤ 5 MB)
 *  2. Compress with browser-image-compression (max 1 MB / 1280 px)
 *  3. Call getSignedUploadUrl server action to get a pre-signed PUT URL
 *  4. PUT the compressed file directly to Supabase Storage
 *  5. Call saveTaskImagePath server action to persist the storage path
 */

import { useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import {
  getSignedUploadUrl,
  saveTaskImagePath,
  removeTaskImage,
} from "@/app/actions/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_MB = 5;

export function useImageUpload(orgId: string, taskId: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /**
   * Compresses and uploads a file, then saves the storage path.
   * Calls `onSuccess` with the new storage path on completion.
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
        // 1. Compress
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
          fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
        });

        // 2. Get signed upload URL from server
        const urlResult = await getSignedUploadUrl(
          orgId,
          taskId,
          compressed.type,
        );
        if (!urlResult.ok) {
          setError(urlResult.error);
          onError?.();
          return;
        }

        // 3. PUT directly to Supabase Storage (bypasses Vercel body limit)
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

        // 4. Save path to DB
        const saveResult = await saveTaskImagePath(
          orgId,
          taskId,
          urlResult.path,
        );
        if (!saveResult.ok) {
          setError(saveResult.error);
          onError?.();
          return;
        }

        onSuccess(urlResult.path);
      } catch {
        setError("An unexpected error occurred. Please try again.");
        onError?.();
      }
    });
  };

  /**
   * Deletes the task image from storage and clears Task.imageUrl.
   * Calls `onSuccess` when done.
   */
  const remove = (onSuccess: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await removeTaskImage(orgId, taskId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      }
    });
  };

  return { upload, remove, isPending, error };
}
