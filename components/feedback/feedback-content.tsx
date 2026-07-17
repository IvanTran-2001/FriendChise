"use client";

/**
 * FeedbackContent — two-step feedback form for the ActionSidebar.
 *
 * Step 1: Pick type — ISSUE or IDEA (large tap-target cards)
 * Step 2: Write message, optionally attach a screenshot, then submit
 *
 * orgId is read from the URL via useParams so feedback is automatically
 * associated with the user's current org context.
 */

import { useRef, useState, useTransition, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Lightbulb,
  X,
} from "lucide-react";
import { FeedbackType } from "@prisma/client";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { getFeedbackImageUploadUrl } from "@/app/actions/storage";

interface FeedbackContentProps {
  onClose: () => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function FeedbackContent({ onClose }: FeedbackContentProps) {
  const params = useParams();
  const orgId = typeof params?.orgId === "string" ? params.orgId : null;

  const [step, setStep] = useState<"type" | "message" | "done">("type");
  const [type, setType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState("");
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  function selectType(t: FeedbackType) {
    setType(t);
    setStep("message");
  }

  function handleRemoveImage() {
    // Revoke the previous blob URL before clearing
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setImageStoragePath(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
      });

      const urlResult = await getFeedbackImageUploadUrl(compressed.type);
      if (!urlResult.ok) {
        toast.error(urlResult.error);
        return;
      }

      const uploadRes = await fetch(urlResult.signedUrl, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": compressed.type },
      });
      if (!uploadRes.ok) {
        toast.error("Upload failed. Please try again.");
        return;
      }

      setImageStoragePath(urlResult.path);
      // Revoke previous blob URL before creating a new one
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const newBlobUrl = URL.createObjectURL(compressed);
      blobUrlRef.current = newBlobUrl;
      setImagePreview(newBlobUrl);
    } catch {
      toast.error("Something went wrong during upload.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit() {
    if (!type || !message.trim()) return;
    startTransition(async () => {
      const result = await submitFeedbackAction(
        type,
        message,
        orgId,
        imageStoragePath,
      );
      if (result.ok) {
        setStep("done");
      } else {
        toast.error("Failed to submit feedback. Please try again.");
      }
    });
  }

  // ── Done state ────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium">Thanks for the feedback!</p>
        <p className="text-xs text-muted-foreground">
          We read every submission and use it to improve the app.
        </p>
        <Button size="sm" variant="outline" onClick={onClose} className="mt-2">
          Close
        </Button>
      </div>
    );
  }

  // ── Step 2: message ───────────────────────────────────────────────────────
  if (step === "message" && type) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {/* Back + type label */}
        <button
          onClick={() => setStep("type")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          ← Change type
        </button>

        <div className="flex items-center gap-2">
          {type === "ISSUE" ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Lightbulb className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            {type === "ISSUE" ? "Report an issue" : "Share an idea"}
          </span>
        </div>

        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            type === "ISSUE"
              ? "Describe what went wrong…"
              : "Describe your idea or suggestion…"
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-35"
        />

        {/* Image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {imagePreview ? (
          <div className="relative rounded-md overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Screenshot preview"
              className="w-full object-cover max-h-48"
            />
            <button
              onClick={handleRemoveImage}
              className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-0.5 hover:bg-background transition-colors"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {isUploading ? "Uploading…" : "Attach screenshot"}
          </Button>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!message.trim() || isPending || isUploading}
          className="w-full"
          size="sm"
        >
          {isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    );
  }

  // ── Step 1: type picker ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-xs text-muted-foreground">
        What kind of feedback do you have?
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => selectType("ISSUE")}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6",
            "hover:border-destructive/60 hover:bg-destructive/5 transition-all cursor-pointer",
          )}
        >
          <AlertCircle className="h-7 w-7 text-destructive" />
          <span className="text-sm font-medium">Issue</span>
        </button>

        <button
          onClick={() => selectType("IDEA")}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-card p-6",
            "hover:border-amber-500/60 hover:bg-amber-500/5 transition-all cursor-pointer",
          )}
        >
          <Lightbulb className="h-7 w-7 text-amber-500" />
          <span className="text-sm font-medium">Idea</span>
        </button>
      </div>
    </div>
  );
}
