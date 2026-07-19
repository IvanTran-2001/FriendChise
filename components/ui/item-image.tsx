"use client";

/**
 * ItemImage — shared image box for ToolItem images (catalog cards/rows, grid
 * cells, detail panel headers).
 *
 * Renders a per-name hue-tinted placeholder immediately (same hue formula used
 * across the item-list tool for the initials fallback), pulses it gently while
 * the real image is loading, then cross-fades the loaded image in. Falls back
 * to the same tinted initials tile permanently on a load error (e.g. an
 * expired signed URL) instead of a broken-image icon.
 *
 * Keyed internally by `src` so switching between items (which swaps `src`)
 * always re-triggers the loading/fade sequence instead of reusing stale state.
 */

import { useState } from "react";
import { cn } from "@/lib/core/utils";

interface ItemImageProps {
  src: string | null | undefined;
  name: string;
  className?: string;
  imgClassName?: string;
  fallbackTextClassName?: string;
}

function hueForName(name: string): number {
  const chars = [...(name || "?")];
  return chars.reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

export function ItemImage({
  src,
  name,
  className,
  imgClassName,
  fallbackTextClassName = "text-4xl",
}: ItemImageProps) {
  const imageKey = src ?? "__fallback__";

  return (
    <ItemImageInner
      key={imageKey}
      src={src}
      name={name}
      className={className}
      imgClassName={imgClassName}
      fallbackTextClassName={fallbackTextClassName}
    />
  );
}

function ItemImageInner({
  src,
  name,
  className,
  imgClassName,
  fallbackTextClassName,
}: ItemImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const hue = hueForName(name);
  const bg = `hsl(${hue} 55% 88%)`;
  const fg = `hsl(${hue} 45% 38%)`;
  const showImage = !!src && !errored;
  const showFallback = !showImage || !loaded;

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden", className)}
      style={{ backgroundColor: bg }}
    >
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={name}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      )}
      {showFallback && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center select-none font-bold",
            showImage && !loaded && "animate-pulse",
          )}
          style={{ color: fg }}
        >
          <span className={fallbackTextClassName}>
            {(name || "?").charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
