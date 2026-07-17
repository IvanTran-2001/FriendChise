"use client";

/**
 * ImageCropDialog — reusable crop-and-zoom image editor dialog.
 *
 * Usage:
 * ```tsx
 * const LOGO_CROP: ImageCropConfig = { aspect: 1, outputWidth: 512, outputHeight: 512 };
 * const TASK_CROP: ImageCropConfig = { aspect: 1, outputWidth: 600, outputHeight: 600 };
 *
 * <ImageCropDialog
 *   file={pendingFile}        // null = closed
 *   config={LOGO_CROP}
 *   onCrop={(croppedFile) => handleUpload(croppedFile)}
 *   onCancel={() => setPendingFile(null)}
 * />
 * ```
 *
 * The dialog handles:
 *   - Pan / drag the crop box
 *   - Zoom via slider (1× – 10×); restrictPosition={false} so the image
 *     can be panned to place edges or corners inside the crop area
 *   - Canvas resize to `outputWidth × outputHeight` on confirm;
 *     out-of-bounds areas are filled white
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialogs/dialog";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageCropConfig {
  /** Aspect ratio of the crop area. 1 = square, 4/3 = landscape, 16/9 = widescreen. */
  aspect: number;
  /** Width of the output image in pixels. */
  outputWidth: number;
  /** Height of the output image in pixels. */
  outputHeight: number;
}

// ─── Canvas crop helper ───────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = src;
  });
}

async function cropToFile(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth: number,
  outputHeight: number,
  mimeType: string,
  fileName: string,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  // Fill with white so any out-of-bounds area (near edges) isn't transparent/black
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas produced no output"));
          return;
        }
        resolve(new File([blob], fileName, { type: mimeType }));
      },
      mimeType,
      0.92,
    );
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageCropDialog({
  file,
  config,
  onCrop,
  onCancel,
}: {
  /** The raw file selected by the user. Pass `null` to close the dialog. */
  file: File | null;
  config: ImageCropConfig;
  /** Called with the cropped + resized File when the user confirms. */
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state whenever a new file is loaded
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [file]);

  // Create and revoke the object URL to avoid memory leaks
  const imageSrc = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels || !file) return;
    setIsProcessing(true);
    try {
      const cropped = await cropToFile(
        imageSrc,
        croppedAreaPixels,
        config.outputWidth,
        config.outputHeight,
        file.type || "image/jpeg",
        file.name,
      );
      onCrop(cropped);
    } finally {
      setIsProcessing(false);
    }
  }

  const isSquare = Math.abs(config.aspect - 1) < 0.01;

  const handleOpenChange = (open: boolean) => {
    // Prevent closing while processing
    if (!open && !isProcessing) {
      onCancel();
    }
  };

  const handleCancel = () => {
    // Prevent cancel while processing
    if (!isProcessing) {
      onCancel();
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-4" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>

        {/* Crop canvas */}
        {imageSrc && (
          <div
            className="relative w-full overflow-hidden rounded-lg bg-black"
            style={{ height: isSquare ? 320 : 240 }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={10}
              aspect={config.aspect}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
            />
          </div>
        )}

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground w-8 shrink-0">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary h-1.5 cursor-pointer"
            aria-label="Zoom"
            disabled={isProcessing}
          />
          <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">
            {zoom.toFixed(1)}×
          </span>
        </div>

        <p className="text-xs text-muted-foreground -mt-1">
          Output: {config.outputWidth} × {config.outputHeight} px
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? "Processing…" : "Apply Crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
