import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Maximize2, Menu, Minimize2, Volume2, VolumeOff } from "lucide-react";
import { useEffect, useState } from "react";

type DemoTourLaunchersProps = {
  isActive: boolean;
  isMobile: boolean;
  sidebarOpen: boolean;
  minimized: boolean;
  muted: boolean;
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  isTransitioning: boolean;
  label: string;
  onOpenSidebar: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReopen: () => void;
};

export function DemoTourLaunchers({
  isActive,
  isMobile,
  sidebarOpen,
  minimized,
  muted,
  stepIndex,
  totalSteps,
  canGoBack,
  canGoNext,
  isTransitioning,
  label,
  onOpenSidebar,
  onToggleMute,
  onMinimize,
  onRestore,
  onPrevious,
  onNext,
  onReopen,
}: DemoTourLaunchersProps) {
  const [mounted, setMounted] = useState(false);
  const [bannerSlot, setBannerSlot] = useState<HTMLElement | null>(null);
  const bannerSlotSelector = isMobile
    ? "[data-demo-tour-banner-slot-mobile]"
    : "[data-demo-tour-banner-slot-desktop]";

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updateBannerSlot = () => {
      setBannerSlot(document.querySelector<HTMLElement>(bannerSlotSelector));
    };

    updateBannerSlot();

    const observer = new MutationObserver(updateBannerSlot);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [mounted, bannerSlotSelector]);

  const launchButtonLabel = minimized
    ? isMobile
      ? `${stepIndex + 1}/${totalSteps}`
      : `Resume overview`
    : isActive
      ? `Demo overview`
      : `Demo ${label}`;

  const compactBannerButtons = (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 bg-card/95 px-1.5 py-1 shadow-sm backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggleMute}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-md"
        aria-label={muted ? "Unmute demo guide" : "Mute demo guide"}
      >
        {muted ? <VolumeOff className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoBack || isTransitioning}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-card/95 disabled:hover:shadow-sm"
        aria-label={`Previous step ${stepIndex + 1} of ${totalSteps}`}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <span
        className="min-w-12 px-1.5 text-center text-[11px] font-semibold tabular-nums text-foreground/80"
        aria-live="polite"
      >
        {stepIndex + 1}/{totalSteps}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext || isTransitioning}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-card/95 disabled:hover:shadow-sm"
        aria-label={`Next step ${stepIndex + 1} of ${totalSteps}`}
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={minimized ? onRestore : onMinimize}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-card/95 text-foreground shadow-sm backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-md"
        aria-label={minimized ? "Expand demo guide" : "Minimize demo guide"}
      >
        {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  const bannerButton = (
    <button
      type="button"
      onClick={muted ? onToggleMute : !isActive ? onReopen : minimized ? onRestore : onMinimize}
      className={
        "pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-sm backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md " +
        (muted
          ? "border-amber-500/30 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15 dark:text-amber-200"
          : "border-border/70 bg-card/95 text-foreground hover:bg-card")
      }
      aria-label={!isActive ? `Reopen demo guide` : minimized ? `Resume demo overview` : `Minimize demo overview`}
    >
      {!isActive ? (
        <Volume2 className="h-3.5 w-3.5" />
      ) : minimized ? (
        <Maximize2 className="h-3.5 w-3.5" />
      ) : (
        <Minimize2 className="h-3.5 w-3.5" />
      )}
      {launchButtonLabel}
    </button>
  );

  if (bannerSlot) {
    if (isActive) {
      return createPortal(compactBannerButtons, bannerSlot);
    }

    return createPortal(bannerButton, bannerSlot);
  }

  return (
    <>
      {!isMobile && mounted && (
        <div className="pointer-events-none fixed right-4 top-4 z-50">
          {isActive ? compactBannerButtons : bannerButton}
        </div>
      )}
      {isMobile && !sidebarOpen && (
        <button
          type="button"
          onClick={onOpenSidebar}
          className="pointer-events-auto fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl hover:bg-card"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      )}
    </>
  );
}