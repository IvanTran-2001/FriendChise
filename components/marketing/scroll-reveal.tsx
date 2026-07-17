"use client";

/**
 * Scroll-triggered reveal wrapper for the marketing homepage.
 *
 * Fades + slides content in once it enters the viewport, using a single
 * shared IntersectionObserver-per-instance (cheap enough at homepage scale —
 * a dozen sections, not a long list). Renders content fully visible with no
 * animation when the visitor prefers reduced motion.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/core/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();
  const visible = reducedMotion || inView;

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      style={reducedMotion ? undefined : { transitionDelay: `${delayMs}ms` }}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
