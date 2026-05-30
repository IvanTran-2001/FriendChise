"use client";

/**
 * OrgImagePicker — dialog-based picker with two modes:
 *   • Upload  — file input → crop → compress → upload to org library → callback
 *   • Library — searchable grid of org library images → click to select → callback
 *
 * Usage:
 * ```tsx
 * <OrgImagePicker
 *   orgId={orgId}
 *   config={{ aspect: 1, outputWidth: 512, outputHeight: 512 }}
 *   onSelect={(storagePath, signedUrl) => setImage(storagePath, signedUrl)}
 * >
 *   <Button variant="outline">Pick Image</Button>
 * </OrgImagePicker>
 * ```
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type ChangeEvent,
} from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Search, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ImageCropDialog,
  type ImageCropConfig,
} from "@/components/ui/image-crop-dialog";
import {
  getSignedOrgImageUploadUrl,
  saveOrgImageToLibrary,
  getOrgImagesWithSignedUrls,
  deleteOrgImageAction,
} from "@/app/actions/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LibraryImage {
  id: string;
  storagePath: string;
  name: string | null;
  signedUrl: string;
}

export interface OrgImagePickerProps {
  orgId: string;
  config: ImageCropConfig;
  onSelect: (storagePath: string, signedUrl: string) => void;
  /** Custom trigger element. Defaults to a generic icon button. */
  trigger?: ReactNode;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_MB = 5;

type Tab = "upload" | "library";

export function OrgImagePicker({
  orgId,
  config,
  onSelect,
  trigger,
  disabled,
}: OrgImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("library");

  // Upload tab state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library tab state
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load library whenever the dialog opens or tab switches to library ──────
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    const result = await getOrgImagesWithSignedUrls(orgId);
    setLibraryLoading(false);
    if (!result.ok) {
      setLibraryError(result.error);
      return;
    }
    setImages(result.images);
  }, [orgId]);

  useEffect(() => {
    if (open && tab === "library") loadLibrary();
  }, [open, tab, loadLibrary]);

  // ── Reset upload state when dialog closes ─────────────────────────────────
  useEffect(() => {
    if (!open) {
      setPendingFile(null);
      setUploadError(null);
      setSearch("");
    }
  }, [open]);

  // ── File selection ────────────────────────────────────────────────────────
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    if (file.size > MAX_RAW_MB * 1024 * 1024) {
      setUploadError(`Image must be smaller than ${MAX_RAW_MB} MB.`);
      return;
    }
    setPendingFile(file);
  }

  // ── After crop: compress → upload → save to library → callback ────────────
  async function handleCrop(croppedFile: File) {
    setPendingFile(null);
    setIsUploading(true);
    setUploadError(null);
    try {
      // Compress
      const compressed = await imageCompression(croppedFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: Math.max(config.outputWidth, config.outputHeight),
        useWebWorker: true,
        fileType: croppedFile.type as "image/jpeg" | "image/png" | "image/webp",
      });

      // Get signed upload URL
      const urlResult = await getSignedOrgImageUploadUrl(orgId, compressed.type);
      if (!urlResult.ok) {
        setUploadError(urlResult.error);
        return;
      }

      // PUT to Supabase
      const uploadRes = await fetch(urlResult.signedUrl, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": compressed.type },
      });
      if (!uploadRes.ok) {
        setUploadError("Upload failed. Please try again.");
        return;
      }

      // Save to library
      const saveResult = await saveOrgImageToLibrary(orgId, urlResult.path);
      if (!saveResult.ok) {
        setUploadError(saveResult.error);
        return;
      }

      onSelect(saveResult.image.storagePath, saveResult.image.signedUrl);
      setOpen(false);
    } catch {
      setUploadError("An unexpected error occurred. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // ── Library: select ───────────────────────────────────────────────────────
  function handleLibrarySelect(img: LibraryImage) {
    onSelect(img.storagePath, img.signedUrl);
    setOpen(false);
  }

  // ── Library: delete ───────────────────────────────────────────────────────
  async function handleDelete(e: React.MouseEvent, img: LibraryImage) {
    e.stopPropagation();
    setDeletingId(img.id);
    await deleteOrgImageAction(orgId, img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    setDeletingId(null);
  }

  // ── Filtered images ───────────────────────────────────────────────────────
  const filtered = images.filter((img) =>
    search
      ? (img.name ?? img.storagePath)
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  );

  return (
    <>
      {/* Trigger */}
      <span
        onClick={() => !disabled && setOpen(true)}
        className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
      >
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            tabIndex={-1}
            className="shrink-0"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
        )}
      </span>

      {/* Crop dialog (rendered outside main dialog to avoid nesting issues) */}
      <ImageCropDialog
        file={pendingFile}
        config={config}
        onCrop={handleCrop}
        onCancel={() => setPendingFile(null)}
      />

      {/* Main picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>Image Library</DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex border-b px-5">
            {(["library", "upload"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  "pb-2 px-3 text-sm font-medium border-b-2 transition-colors capitalize",
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Upload tab ────────────────────────────────────────────────── */}
          {tab === "upload" && (
            <div className="flex flex-col items-center justify-center gap-4 px-5 py-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Uploading…</span>
                </div>
              ) : (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) =>
                      e.key === "Enter" && fileInputRef.current?.click()
                    }
                    className="flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed border-muted-foreground/30 py-10 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <ImagePlus className="h-10 w-10 text-muted-foreground/50" />
                    <span className="text-sm text-muted-foreground">
                      Click to select an image
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      JPEG, PNG or WebP · max {MAX_RAW_MB} MB
                    </span>
                  </div>
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Library tab ───────────────────────────────────────────────── */}
          {tab === "library" && (
            <div className="flex flex-col gap-3 px-5 py-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search images…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Grid */}
              {libraryLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : libraryError ? (
                <p className="text-sm text-destructive py-4 text-center">
                  {libraryError}
                </p>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <ImagePlus className="h-8 w-8 opacity-40" />
                  <p className="text-sm">
                    {search
                      ? "No images match your search."
                      : "No images in the library yet. Upload one!"}
                  </p>
                  {!search && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => setTab("upload")}
                    >
                      Upload image
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                  {filtered.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => handleLibrarySelect(img)}
                      className="group relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                      title={img.name ?? undefined}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.signedUrl}
                        alt={img.name ?? "Library image"}
                        className="w-full h-full object-cover"
                      />
                      {/* Delete button */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDelete(e, img)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleDelete(e as unknown as React.MouseEvent, img);
                        }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5"
                        aria-label="Delete image"
                      >
                        {deletingId === img.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t">
            {tab === "library" && !libraryLoading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTab("upload")}
              >
                Upload new
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
