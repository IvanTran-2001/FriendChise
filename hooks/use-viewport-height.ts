import * as React from "react";

/**
 * Returns the current viewport height in pixels, updating when the window or
 * visual viewport changes size. Returns `undefined` until the client-side
 * measurement has run.
 */
export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    const measureViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
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
  }, []);

  return viewportHeight;
}