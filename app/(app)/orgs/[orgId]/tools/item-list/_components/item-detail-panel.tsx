"use client";

/**
 * ItemDetailPanel — ActionSidebar panel for creating or editing a ToolItem.
 *
 * Mode "create": name field → create item, call onCreated.
 * Mode "edit":   shows current image (upload / remove), name → save or delete.
 *
 * Image upload flow (edit only):
 *   1. User picks a file → compressed client-side.
 *   2. getSignedToolItemUploadUrl → pre-signed PUT URL from server.
 *   3. PUT compressed file directly to Supabase Storage.
 *   4. saveToolItemImagePath persists the path in DB.
 *   5. Preview shown immediately via object URL; caller receives updated item.
 */

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemImage } from "@/components/ui/item-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/dialogs/alert-dialog";
import {
} from "@/app/actions/tools";
import {
  createToolItemAction,
  updateToolItemAction,
  deleteToolItemAction,
} from "@/app/actions/tools/conversion";
import { removeToolItemImage } from "@/app/actions/storage";
import { ToolItemImagePicker } from "@/components/ui/pickers/tool-item-image-picker";
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
  const [unit, setUnit] = useState("each");
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
        unit,
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

function EditForm({ orgId, item, canManage, onUpdated, onDeleted, onClose: _onClose }: EditProps) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit || "each");
  // Tracks the display URL — either the server-resolved signed URL or a local preview.
  const [previewUrl, setPreviewUrl] = useState<string | null>(item.imageSignedUrl);
  // The current stored path (kept in sync after upload/remove so deletes work).
  const imgPathRef = useRef<string | null>(item.imgUrl);

  const [isSaving, startSavingTransition] = useTransition();
  const [isRemoving, startRemovingTransition] = useTransition();
  const [isDeleting, startDeletingTransition] = useTransition();

  const isBusy = isSaving || isRemoving || isDeleting;

  function handleRemoveImage() {
    startRemovingTransition(async () => {
      const result = await removeToolItemImage(orgId, item.id);
      if (!result.ok) {
        toast.error("error" in result ? result.error : "Failed to remove image.");
        return;
      }
      setPreviewUrl(null);
      imgPathRef.current = null;
      onUpdated({ ...item, name, imgUrl: null, imageSignedUrl: null });
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

  return (
    <div className="flex flex-col gap-0">
      {/* ── Image area ──────────────────────────────────────────────────── */}
      <div className="relative bg-muted/30 border-b">
        <div className="aspect-square max-h-56 w-full overflow-hidden">
          <ItemImage src={previewUrl} name={item.name} fallbackTextClassName="text-7xl" />
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
            <ToolItemImagePicker
              orgId={orgId}
              itemId={item.id}
              disabled={isBusy}
              onSelect={(storagePath, signedUrl) => {
                setPreviewUrl(signedUrl);
                imgPathRef.current = storagePath;
                onUpdated({ ...item, name, imgUrl: storagePath, imageSignedUrl: signedUrl });
                toast.success("Image updated.");
              }}
              trigger={
                <button
                  type="button"
                  disabled={isBusy}
                  className="h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm border flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-50"
                  title={previewUrl ? "Change image" : "Add image"}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
              }
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
            placeholder="e.g. each, g, ml"
            required
            disabled={!canManage || isBusy}
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isBusy}
                  className="w-full gap-2"
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
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &ldquo;{item.name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the item from your catalog and from any
                    lists it appears in. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </form>
    </div>
  );
}
