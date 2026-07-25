"use client";

import { cn } from "@/lib/core/utils";
import { useEffect, useState } from "react";

export type DemoTourHighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DemoTourOverlayProps = {
  maskId: string;
  targetRects: DemoTourHighlightRect[];
};

export function DemoTourOverlay({ maskId, targetRects }: DemoTourOverlayProps) {
  const [bannerRect, setBannerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateBannerRect = () => {
      const banner = document.querySelector<HTMLElement>("[data-demo-banner]");
      setBannerRect(banner ? banner.getBoundingClientRect() : null);
    };

    updateBannerRect();
    window.addEventListener("resize", updateBannerRect);
    window.addEventListener("scroll", updateBannerRect, true);

    const banner = document.querySelector<HTMLElement>("[data-demo-banner]");
    const resizeObserver = banner ? new ResizeObserver(updateBannerRect) : null;
    if (banner && resizeObserver) {
      resizeObserver.observe(banner);
    }

    return () => {
      window.removeEventListener("resize", updateBannerRect);
      window.removeEventListener("scroll", updateBannerRect, true);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <>
      {/* Dark mask with holes. This dims the page around the highlighted targets. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {bannerRect && (
              <rect
                x={bannerRect.left}
                y={bannerRect.top}
                width={bannerRect.width}
                height={bannerRect.height}
                fill="black"
              />
            )}
            {targetRects.map((rect, index) => (
              <rect
                key={`${rect.top}-${rect.left}-${rect.width}-${rect.height}-${index}`}
                x={rect.left - 10}
                y={rect.top - 10}
                width={rect.width + 20}
                height={rect.height + 20}
                rx="24"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(15, 23, 42, 0.28)" mask={`url(#${maskId})`} />
      </svg>

      {/* Bright outline boxes. These are the actual visible highlight frames. */}
      {targetRects.map((rect, index) => (
        <div
          key={`${rect.top}-${rect.left}-${rect.width}-${rect.height}-${index}`}
          className={cn(
            "pointer-events-none absolute rounded-[1.5rem] border border-white/95 bg-transparent ring-4 ring-sky-300/15 shadow-[0_0_0_1px_rgba(255,255,255,0.96),0_0_0_8px_rgba(96,165,250,0.12),0_0_32px_rgba(96,165,250,0.2)] transition-[top,left,width,height] duration-300 ease-out",
          )}
          style={{
            top: rect.top - 10,
            left: rect.left - 10,
            width: rect.width + 20,
            height: rect.height + 20,
          }}
        />
      ))}
    </>
  );
}