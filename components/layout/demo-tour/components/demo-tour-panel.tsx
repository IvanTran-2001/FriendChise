import { ArrowLeft, ArrowRight, Minus, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DemoTourPanelProps = {
  label: string;
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function DemoTourPanel({
  label,
  title,
  description,
  stepIndex,
  totalSteps,
  canGoBack,
  canGoNext,
  muted,
  onToggleMute,
  onMinimize,
  onClose,
  onPrevious,
  onNext,
}: DemoTourPanelProps) {
  const [bannerHeight, setBannerHeight] = useState(0);
  const bannerOffset = bannerHeight > 0 ? bannerHeight + 16 : 16;

  useEffect(() => {
    const updateBannerHeight = () => {
      const banner = document.querySelector<HTMLElement>("[data-demo-banner]");
      setBannerHeight(banner ? banner.getBoundingClientRect().height : 0);
    };

    updateBannerHeight();
    window.addEventListener("resize", updateBannerHeight);

    const banner = document.querySelector<HTMLElement>("[data-demo-banner]");
    const resizeObserver = banner ? new ResizeObserver(updateBannerHeight) : null;
    if (banner && resizeObserver) {
      resizeObserver.observe(banner);
    }

    return () => {
      window.removeEventListener("resize", updateBannerHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div
      className="pointer-events-auto fixed left-1/2 bottom-4 z-10001 w-[min(92vw,20rem)] -translate-x-1/2 sm:left-auto sm:right-4 sm:bottom-auto sm:top-(--demo-tour-panel-top) sm:w-[20rem] sm:translate-x-0 md:w-84"
      style={{
        bottom: bannerHeight > 0 ? bannerHeight + 16 : 16,
        ["--demo-tour-panel-top" as string]: `${bannerOffset}px`,
      }}
    >
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_20px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Demo {label}
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground sm:text-base">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 px-2.5 text-xs font-medium text-muted-foreground cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm"
              aria-label={muted ? "Unmute demo guide" : "Mute demo guide"}
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              {muted ? "Muted" : "Mute"}
            </button>
            <button
              type="button"
              onClick={onMinimize}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm"
              aria-label="Minimize demo guide"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-muted hover:text-foreground hover:shadow-sm"
              aria-label="Close demo guide"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>

          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={
                  "h-1.5 flex-1 rounded-full transition-colors " +
                  (index === stepIndex ? "bg-primary" : "bg-border")
                }
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              disabled={!canGoBack}
              className="h-10 rounded-full px-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <span aria-hidden="true" className="w-29" />

            <Button
              type="button"
              onClick={onNext}
              disabled={!canGoNext}
              variant="outline"
              className="h-10 rounded-full px-3"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}