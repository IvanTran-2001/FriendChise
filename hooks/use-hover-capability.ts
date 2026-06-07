import * as React from "react";

/**
 * Returns true when hover is a reliable primary interaction mode.
 * Touch-capable devices fall back to false so hover-only controls stay visible.
 */
export function useSupportsHover() {
  const [supportsHover, setSupportsHover] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const update = () => {
      const hasTouch =
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches;
      const canHover =
        window.matchMedia("(hover: hover)").matches && !hasTouch;
      setSupportsHover(canHover);
    };

    update();

    const mql = window.matchMedia("(hover: hover)");
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return !!supportsHover;
}