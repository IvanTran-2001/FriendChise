"use client";

/**
 * Animated stat used in the marketing homepage's proof strip.
 *
 * Counts up from 0 to `value` once the stat scrolls into view. Renders the
 * final value immediately (no animation) when the visitor prefers reduced
 * motion.
 */
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const DURATION_MS = 1200;

export function Counter({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const reducedMotion = useReducedMotion();
  const shown = reducedMotion ? value : display;

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;

    let frame: number;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        let start: number | undefined;
        const tick = (now: number) => {
          if (start === undefined) start = now;
          const progress = Math.min((now - start) / DURATION_MS, 1);
          const eased = 1 - (1 - progress) * (1 - progress);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, reducedMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
