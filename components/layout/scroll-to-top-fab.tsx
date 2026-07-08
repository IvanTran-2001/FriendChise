"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTopFab() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current = document.querySelector("main") as HTMLElement | null;

    function getScrollTop() {
      const mainScrollTop = mainRef.current?.scrollTop ?? 0;
      return Math.max(window.scrollY, mainScrollTop);
    }

    function updateScrollTopVisibility() {
      setShowScrollTop(getScrollTop() > 240);
    }

    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });

    const scrollContainer = mainRef.current;
    scrollContainer?.addEventListener("scroll", updateScrollTopVisibility, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrollTopVisibility);
      scrollContainer?.removeEventListener("scroll", updateScrollTopVisibility);
    };
  }, []);

  function scrollToTop() {
    const scrollContainer = mainRef.current ?? (document.querySelector("main") as HTMLElement | null);

    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!showScrollTop) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-4 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
