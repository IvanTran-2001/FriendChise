import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Returns the current viewport height in pixels, updating when the window or
 * visual viewport changes size. Returns `undefined` until the client-side
 * measurement has run.
 */
export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = React.useState<number | undefined>(undefined);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    const measureViewportHeight = () => {
      const nextHeight = isMobile ? window.visualViewport?.height ?? window.innerHeight : window.screen.height;
      setViewportHeight(nextHeight);
    };

    measureViewportHeight();
    window.addEventListener("resize", measureViewportHeight);
    window.addEventListener("orientationchange", measureViewportHeight);
    window.visualViewport?.addEventListener("resize", measureViewportHeight);

    return () => {
      window.removeEventListener("resize", measureViewportHeight);
      window.removeEventListener("orientationchange", measureViewportHeight);
      window.visualViewport?.removeEventListener("resize", measureViewportHeight);
    };
  }, [isMobile]);

  return viewportHeight;
}