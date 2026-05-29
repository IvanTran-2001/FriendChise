"use client";

/**
 * ItemDetailPanel — ActionSidebar panel for creating or editing a ToolItem.
 *
 * Mode "create": name + unit fields → create item, call onCreated.
 * Mode "edit":   shows current image (upload / remove), name, unit → save or delete.
 *
 * Image upload flow (edit only):
 *   1. User picks a file → compressed client-side.
 *   2. getSignedToolItemUploadUrl → pre-signed PUT URL from server.
 *   3. PUT compressed file directly to Supabase Storage.
 *   4. saveToolItemImagePath persists the path in DB.
 *   5. Preview shown immediately via object URL; caller receives updated item.
 */

import { useRef, useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createToolItemAction,
  updateToolItemAction,
  deleteToolItemAction,
} from "@/app/actions/tools";
import {
  getSignedToolItemUploadUrl,
  saveToolItemImagePath,
  removeToolItemImage,
} from "@/app/actions/storage";
import type { ToolItem } from "./item-list-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreateProps = {
  orgId: string;
  mode: "create";
  canManage: boolean;
  onCreated: (item: ToolItem) => void;
  onClose: () => void;
};

type EditProps = {
  orgId: string;
  mode: "edit";
  item: ToolItem;
  canManage: boolean;
  onUpdated: (item: ToolItem) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

type Props = CreateProps | EditProps;

// ─── Component ────────────────────────────────────────────────────────────────

export function ItemDetailPanel(props: Props) {
  if (props.mode === "create") return <CreateForm {...props} />;
  return <EditForm {...props} />;
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ orgId, onCreated }: CreateProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createToolItemAction(orgId, name, unit);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to create item.");
        return;
      }
      toast.success(`"${name.trim()}" created.`);
      onCreated({
        ...result.item,
        imgUrl: null,
        imageSignedUrl: null,
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-item-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="new-item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Custard"
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-item-unit" className="text-sm font-medium">
          Unit
        </label>
        <Input
          id="new-item-unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g. each, g, ml"
          required
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          The measurement unit shown in conversion rates.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isPending || !name.trim() || !unit.trim()}
        className="w-full"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Create Item"
        )}
      </Button>
    </form>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_MB = 5;

function EditForm({ orgId, item, canManage, onUpdated, onDeleted, onClose: _onClose }: EditProps) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  // Tracks the display URL — either the server-resolved signed URL or a local preview.
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.imageSignedUrl);
  // The current stored path (kept in sync after upload/remove so deletes work).
  const imgPathRef = useRef<string | null>(item.imgUrl);

  const [isSaving, startSavingTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, startRemovingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isSaving || isUploading || isRemoving || isDeleting;

  // ── Image upload ───────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    if (file.size > MAX_RAW_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${MAX_RAW_MB} MB.`);
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

      const urlResult = await getSignedToolItemUploadUrl(
        orgId,
        item.id,
        compressed.type,
      );
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

      const saveResult = await saveToolItemImagePath(orgId, item.id, urlResult.path);
      if (!saveResult.ok) {
        toast.error(saveResult.error);
        return;
      }

      // Show the new image immediately via a local blob URL.
      const blobUrl = URL.createObjectURL(compressed);
      setPreviewUrl(blobUrl);
      imgPathRef.current = urlResult.path;
      onUpdated({ ...item, name, unit, imgUrl: urlResult.path, imageSignedUrl: blobUrl });
      toast.success("Image updated.");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleRemoveImage() {
    startRemovingTransition(async () => {
      const result = await removeToolItemImage(orgId, item.id);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to remove image.");
        return;
      }
      setPreviewUrl(null);
      imgPathRef.current = null;
      onUpdated({ ...item, name, unit, imgUrl: null, imageSignedUrl: null });
      toast.success("Image removed.");
    });
  }

  // ── Save name/unit ─────────────────────────────────────────────────────────

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startSavingTransition(async () => {
      const result = await updateToolItemAction(orgId, item.id, name, unit);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to save.");
        return;
      }
      onUpdated({
        ...item,
        name: name.trim(),
        unit: unit.trim(),
        imgUrl: imgPathRef.current,
        imageSignedUrl: previewUrl,
      });
      toast.success("Saved.");
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete() {
    startDeletingTransition(async () => {
      const result = await deleteToolItemAction(orgId, item.id);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to delete.");
        return;
      }
      onDeleted(item.id);
      toast.success(`"${item.name}" deleted.`);
    });
  }

  // Generate placeholder color from item name
  const hue = [...item.name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;

  return (
    <div className="flex flex-col gap-0">
      {/* ── Image area ──────────────────────────────────────────────────── */}
      <div className="relative bg-muted/30 border-b">
        <div className="aspect-square max-h-56 w-full overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-7xl font-bold select-none"
              style={{ backgroundColor: bg, color: fg }}
            >
              {item.name.charAt(0).toUpperCase()}
            </div>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            </div>
          )}
        </div>

        {/* Image action buttons */}
        {canManage && (
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {previewUrl && (
              <button
                type="button"
                disabled={isBusy}
                onClick={handleRemoveImage}
                className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50"
              title={previewUrl ? "Change image" : "Upload image"}
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleFileChange}
              aria-label="Upload item image"
            />
          </div>
        )}
      </div>

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSave} className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-item-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="edit-item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={!canManage || isBusy}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-item-unit" className="text-sm font-medium">
            Unit
          </label>
          <Input
            id="edit-item-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            required
            disabled={!canManage || isBusy}
            placeholder="e.g. each, g, ml"
          />
        </div>

        {canManage && (
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              disabled={isBusy || !name.trim() || !unit.trim()}
              className="w-full"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy}
              className="w-full gap-2"
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Item
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
