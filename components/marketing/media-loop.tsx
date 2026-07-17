"use client";

/**
 * Product-loop media block for the marketing homepage.
 *
 * Plays a looping GIF to demonstrate a workflow, but swaps to a static poster
 * image for visitors who prefer reduced motion (respects the OS setting
 * rather than always autoplaying). GIFs are rendered as plain <img> tags —
 * next/image's optimizer would otherwise flatten them to a single frame.
 */
import Image from "next/image";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/core/utils";

export function MediaLoop({
  gifSrc,
  posterSrc,
  alt,
  className,
}: {
  gifSrc: string;
  posterSrc: string;
  alt: string;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_20px_60px_rgba(15,23,42,0.10)]",
        className,
      )}
    >
      {reducedMotion ? (
        <Image
          src={posterSrc}
          alt={alt}
          width={1200}
          height={800}
          className="h-auto w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gifSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-auto w-full object-cover"
        />
      )}
    </div>
  );
}
