"use client";

/**
 * Renders text that behaves like a normal ellipsis-truncated label, but
 * smoothly auto-scrolls right-to-left when the text overflows its container.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const PIXELS_PER_SECOND = 18;
const MIN_DURATION_SECONDS = 3;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function ScrollingText({
  text,
  className,
  containerClassName,
}: {
  text: string;
  className?: string;
  containerClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServerSnapshot,
  );

  // Measure whenever the text or container size changes.
  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = () => {
      const diff = Math.ceil(textEl.scrollWidth - container.clientWidth);
      setOverflow(diff > 0 ? diff : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(textEl);
    return () => observer.disconnect();
  }, [text]);

  const shouldScroll = overflow > 0 && !reducedMotion;
  const duration = Math.max(MIN_DURATION_SECONDS, overflow / PIXELS_PER_SECOND);

  return (
    <div
      ref={containerRef}
      className={cn("min-w-0 overflow-hidden", containerClassName)}
    >
      <span
        ref={textRef}
        className={cn(
          shouldScroll ? "inline-block whitespace-nowrap" : "block truncate",
          className,
        )}
        style={
          shouldScroll
            ? ({
                animation: `scrolling-text ${duration}s linear infinite`,
                "--scrolling-text-distance": `-${overflow}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
