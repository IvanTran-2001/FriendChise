/**
 * Shared demo tour renderer.
 * Reads the current pathname, loads the matching config, and handles UI state.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useMobileSidebar } from "@/components/layout/sidebar/sidebar";
import { getDemoTourConfig, STORAGE_KEY_PREFIX } from "./config";
import type { DemoTourConfig, DemoTourStepAction } from "./types";
import { DemoTourLaunchers } from "./components/demo-tour-launchers";
import { DemoTourOverlay, type DemoTourHighlightRect } from "./components/demo-tour-overlay";
import { DemoTourPanel } from "./components/demo-tour-panel";

const MUTED_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-muted`;
const MINIMIZED_STORAGE_KEY = `${STORAGE_KEY_PREFIX}-minimized`;

const ADVANCE_EVENT_ALIASES: Record<string, string[]> = {
  "friendchise:timetable-entry-created": ["friendchise:timetable-placement-completed"],
  "friendchise:timetable-placement-completed": ["friendchise:timetable-entry-created"],
};

type DemoTargetSpec = string | string[];

const TARGET_ATTRIBUTE_NAMES = ["data-tour-target", "data-demo-tour-target"] as const;

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;

  while (node) {
    const style = window.getComputedStyle(node);
    const canScrollY = style.overflowY === "auto" || style.overflowY === "scroll";
    if (canScrollY && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function scrollTargetIntoView(targetSpec: DemoTargetSpec | undefined) {
  const targetName = resolveTargetNames(targetSpec)[0];
  if (!targetName) return false;

  const element = queryTargetElement(targetName);
  if (!element) return false;

  // Only scroll within a genuinely scrollable ancestor. Falling back to
  // document.scrollingElement/documentElement scrolls the whole page (hiding
  // the sticky header/sidebar) when the target lives outside <main>, e.g.
  // inside the page-sidebar panel, which has its own internal scroll region.
  const scrollContainer = findScrollableAncestor(element);
  if (!scrollContainer || scrollContainer === element) return false;

  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const nextTop =
    scrollContainer.scrollTop +
    (elementRect.top - containerRect.top) -
    16;

  scrollContainer.scrollTo({
    top: Math.max(0, nextTop),
    behavior: "auto",
  });
  return true;
}

function queryTargetElement(targetName: string): HTMLElement | null {
  for (const attributeName of TARGET_ATTRIBUTE_NAMES) {
    const elements = document.querySelectorAll<HTMLElement>(`[${attributeName}="${targetName}"]`);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) return element;
    }

    if (elements[0]) return elements[0];
  }

  return null;
}

function resolveTargetNames(targetSpec: DemoTargetSpec | undefined): string[] {
  if (!targetSpec) return [];

  const targetNames = Array.isArray(targetSpec) ? targetSpec : [targetSpec];
  return targetNames.filter((targetName) => queryTargetElement(targetName));
}

function readTargetRect(targetName: string | null): DemoTourHighlightRect | null {
  if (!targetName) return null;

  const element = queryTargetElement(targetName);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function clickTargetElement(targetName: string) {
  const targetElement = queryTargetElement(targetName);
  if (!targetElement) return;

  const clickableElement =
    targetElement.matches("button, a[href], [role='button']")
      ? targetElement
      : targetElement.querySelector<HTMLElement>("button, a[href], [role='button']");

  (clickableElement ?? targetElement).click();
}

function resolveVisibleTargetNames(targetSpec: DemoTargetSpec | undefined): string[] {
  return resolveTargetNames(targetSpec).filter((targetName) => readTargetRect(targetName) !== null);
}

function hasVisibleTarget(targetSpec: DemoTargetSpec | undefined): boolean {
  return resolveVisibleTargetNames(targetSpec).length > 0;
}

function waitForTargets(targetSpec: string | string[], timeoutMs = 3000) {
  return new Promise<boolean>((resolve) => {
    if (hasVisibleTarget(targetSpec)) {
      resolve(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (!hasVisibleTarget(targetSpec)) return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve(true);
    });

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  });
}

function getAdvanceEventNames(eventName: string): string[] {
  return [eventName, ...(ADVANCE_EVENT_ALIASES[eventName] ?? [])];
}

async function runStepAction(action: DemoTourStepAction, router: ReturnType<typeof useRouter>) {
  if (action.type === "navigate" && action.href === "__history_back__") {
    router.back();
    return true;
  }

  if (action.type === "navigate") {
    router.push(action.href);
    return true;
  }

  clickTargetElement(action.target);

  if (action.waitForTarget) {
    return await waitForTargets(action.waitForTarget);
  }

  return true;
}

export function DemoTour({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const config = useMemo(() => getDemoTourConfig(pathname), [pathname]);

  if (!enabled || !config) return null;

  return <DemoTourContent key={pathname} enabled={enabled} config={config} />;
}

function DemoTourContent({
  enabled,
  config,
}: {
  enabled: boolean;
  config: DemoTourConfig;
}) {
  const isMobile = useIsMobile();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useMobileSidebar();
  const router = useRouter();
  const maskId = "friendchise-demo-tour-mask";

  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted, mutedHydrated] = usePersistedState<boolean>(MUTED_STORAGE_KEY, false);
  const [minimized, setMinimized] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRects, setTargetRects] = useState<DemoTourHighlightRect[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const autoAdvanceTriggeredRef = useRef<string | null>(null);
  const eventAdvanceTriggeredRef = useRef<string | null>(null);
  const suppressRetreatRef = useRef(false);
  const transitionPendingRef = useRef(false);
  const minimizedRef = useRef(false);
  const autoScrollTriggeredRef = useRef<string | null>(null);

  const steps = config.steps;
  const step = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const active = enabled && !dismissed && !muted;
  const panelVisible = active && !minimized;
  const stepDescription = useMemo(() => {
    if (!step) return "";
    return step.description.replace(/__ORG_NAME__/g, "this org");
  }, [step]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      try {
        setMinimized(window.sessionStorage.getItem(MINIMIZED_STORAGE_KEY) === "minimized");
      } catch {
        setMinimized(false);
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!active || !step) return;

    const targetSpec = isMobile ? step.mobileTarget ?? step.desktopTarget : step.desktopTarget;
    const targetKey = `${stepIndex}:${Array.isArray(targetSpec) ? targetSpec.join("|") : targetSpec}`;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (autoScrollTriggeredRef.current !== targetKey && scrollTargetIntoView(targetSpec)) {
          autoScrollTriggeredRef.current = targetKey;
        }

        const nextTargetRects = resolveVisibleTargetNames(targetSpec)
          .map((targetName) => readTargetRect(targetName))
          .filter((rect): rect is DemoTourHighlightRect => rect !== null);

        setTargetRects(nextTargetRects);
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("friendchise:demo-tour-targets-changed", update as EventListener);

    const resizeObserver = new ResizeObserver(update);
    const targetNames = resolveTargetNames(targetSpec);
    const elements = targetNames
      .map((targetName) => queryTargetElement(targetName))
      .filter((element): element is HTMLElement => element !== null);
    for (const element of elements) resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("friendchise:demo-tour-targets-changed", update as EventListener);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [active, isMobile, step, stepIndex]);

  const runAction = useCallback(
    async (action: DemoTourStepAction | null) => {
      if (!action) return true;
      return await runStepAction(action, router);
    },
    [router],
  );

  const dismiss = useCallback(() => {
    setDismissed(true);
    setMinimized(false);
    try {
      window.sessionStorage.removeItem(MINIMIZED_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const minimize = useCallback(() => {
    setMinimized(true);
    try {
      window.sessionStorage.setItem(MINIMIZED_STORAGE_KEY, "minimized");
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
  }, [setMuted]);

  const reopen = useCallback(() => {
    setDismissed(false);
    setMinimized(false);
    setStepIndex(0);
    try {
      window.sessionStorage.removeItem(MINIMIZED_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const restore = useCallback(() => {
    setMinimized(false);
    try {
      window.sessionStorage.removeItem(MINIMIZED_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    minimizedRef.current = minimized;
  }, [minimized]);

  const goNext = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, Math.max(steps.length - 1, 0)));
  }, [steps.length]);

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  const releaseTransitionLock = useCallback(() => {
    transitionPendingRef.current = false;
    setIsTransitioning(false);
  }, []);

  const releaseTransitionLockSoon = useCallback(() => {
    window.requestAnimationFrame(() => {
      releaseTransitionLock();
    });
  }, [releaseTransitionLock]);

  useEffect(() => {
    suppressRetreatRef.current = false;
  }, [stepIndex]);

  useEffect(() => {
    autoScrollTriggeredRef.current = null;
  }, [stepIndex]);

  const findNearestValidStepIndex = useCallback(
    (startIndex: number) => {
      let nextIndex = startIndex;

      while (nextIndex > 0) {
        const currentStep = steps[nextIndex];
        const retreatTarget = currentStep?.retreatWhenTargetNotVisible;
        if (!retreatTarget) break;
        if (hasVisibleTarget(retreatTarget)) break;

        nextIndex -= 1;
      }

      return nextIndex;
    },
    [steps],
  );

  useEffect(() => {
    if (!active || !step?.advanceWhenTargetVisible) return;

    autoAdvanceTriggeredRef.current = null;

    const targetSpec = step.advanceWhenTargetVisible;
    const advanceKey = `${stepIndex}:${Array.isArray(targetSpec) ? targetSpec.join("|") : targetSpec}`;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (autoAdvanceTriggeredRef.current === advanceKey) return;
        if (!hasVisibleTarget(targetSpec)) return;

        autoAdvanceTriggeredRef.current = advanceKey;
        goNext();
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("friendchise:demo-tour-targets-changed", update as EventListener);

    const resizeObserver = new ResizeObserver(update);
    const targetNames = resolveTargetNames(targetSpec);
    const elements = targetNames
      .map((targetName) => queryTargetElement(targetName))
      .filter((element): element is HTMLElement => element !== null);
    for (const element of elements) resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("friendchise:demo-tour-targets-changed", update as EventListener);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [goNext, active, step?.advanceWhenTargetVisible, stepIndex]);

  useEffect(() => {
    if (!active || !step?.retreatWhenTargetNotVisible) return;

    const targetSpec = step.retreatWhenTargetNotVisible;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (step?.advanceWhenTargetVisible && hasVisibleTarget(step.advanceWhenTargetVisible)) return;
        if (suppressRetreatRef.current) return;
        const nextIndex = findNearestValidStepIndex(stepIndex);
        if (nextIndex !== stepIndex) {
          setStepIndex(nextIndex);
        }
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("friendchise:demo-tour-targets-changed", update as EventListener);

    const resizeObserver = new ResizeObserver(update);
    const targetNames = resolveTargetNames(targetSpec);
    const elements = targetNames
      .map((targetName) => queryTargetElement(targetName))
      .filter((element): element is HTMLElement => element !== null);
    for (const element of elements) resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("friendchise:demo-tour-targets-changed", update as EventListener);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [findNearestValidStepIndex, active, step?.advanceWhenTargetVisible, step?.retreatWhenTargetNotVisible, stepIndex]);

  useEffect(() => {
    if (!active || !step?.advanceWhenEvent) return;

    eventAdvanceTriggeredRef.current = null;
    const eventName = step.advanceWhenEvent;
    const eventNames = getAdvanceEventNames(eventName);
    const eventKey = `${stepIndex}:${eventNames.join("|")}`;

    const handleEvent = () => {
      if (eventAdvanceTriggeredRef.current === eventKey) return;
      eventAdvanceTriggeredRef.current = eventKey;
      goNext();
    };

    for (const eventType of eventNames) {
      window.addEventListener(eventType, handleEvent);
    }
    return () => {
      for (const eventType of eventNames) {
        window.removeEventListener(eventType, handleEvent);
      }
    };
  }, [goNext, active, step?.advanceWhenEvent, stepIndex]);

  const runCurrentStep = useCallback(async () => {
    if (transitionPendingRef.current) return;

    transitionPendingRef.current = true;
    setIsTransitioning(true);

    const forwardAction = step?.forwardAction ?? null;

    if (forwardAction) {
      suppressRetreatRef.current = true;
      const success = await runAction(forwardAction);
      if (!success) {
        suppressRetreatRef.current = false;
        releaseTransitionLock();
        return;
      }
      if (forwardAction.type === "navigate") return;
    }

    if (!step?.advanceWhenTargetVisible) {
      goNext();
      releaseTransitionLockSoon();
      return;
    }

    releaseTransitionLockSoon();
  }, [goNext, releaseTransitionLock, releaseTransitionLockSoon, runAction, step]);

  const runPreviousStep = useCallback(async () => {
    if (transitionPendingRef.current) return;

    transitionPendingRef.current = true;
    setIsTransitioning(true);

    const backAction = step?.backAction ?? null;

    if (backAction) {
      const success = await runAction(backAction);
      if (!success) {
        releaseTransitionLock();
        return;
      }
      if (backAction.type === "navigate") return;
    }

    goBack();
    releaseTransitionLockSoon();
  }, [goBack, releaseTransitionLock, releaseTransitionLockSoon, runAction, step]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        if (transitionPendingRef.current) return;
        event.preventDefault();
        void runPreviousStep();
        return;
      }

      if (event.key === "ArrowUp") {
        if (transitionPendingRef.current) return;
        event.preventDefault();
        if (!minimizedRef.current) {
          minimize();
        }
        return;
      }

      if (event.key === "ArrowDown") {
        if (transitionPendingRef.current) return;
        event.preventDefault();
        if (minimizedRef.current) {
          restore();
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === " ") {
        if (transitionPendingRef.current) return;
        event.preventDefault();
        void runCurrentStep();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, dismiss, minimize, restore, runCurrentStep, runPreviousStep, stepIndex, steps.length, toggleMute]);

  if (!mutedHydrated) return null;

  if (!step) return null;

  if (!active) {
    return (
      <DemoTourLaunchers
        isActive={false}
        isMobile={!!isMobile}
        sidebarOpen={sidebarOpen}
        minimized={minimized}
        muted={muted}
        stepIndex={stepIndex}
        totalSteps={steps.length}
        label={config.label}
        canGoBack={!isFirstStep || !!step.backAction}
        canGoNext={!isLastStep || !!step.forwardAction}
        isTransitioning={isTransitioning}
        onOpenSidebar={() => setSidebarOpen(true)}
        onToggleMute={toggleMute}
        onMinimize={minimize}
        onRestore={restore}
        onPrevious={() => {
          void runPreviousStep();
        }}
        onNext={() => {
          void runCurrentStep();
        }}
        onReopen={reopen}
      />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-9999">
      <DemoTourOverlay maskId={maskId} targetRects={targetRects} />

      {panelVisible && (() => {
        return (
          <DemoTourPanel
            label={config.label}
            title={step.title}
            description={stepDescription}
            stepIndex={stepIndex}
            totalSteps={steps.length}
            canGoBack={!isFirstStep || !!step.backAction}
            canGoNext={!isLastStep || !!step.forwardAction}
            isTransitioning={isTransitioning}
            muted={muted}
            onToggleMute={toggleMute}
            onMinimize={minimize}
            onClose={dismiss}
            onPrevious={() => {
              void runPreviousStep();
            }}
            onNext={() => {
              void runCurrentStep();
            }}
          />
        );
      })()}

      {!panelVisible && (
        <DemoTourLaunchers
          isActive={active}
          isMobile={!!isMobile}
          sidebarOpen={sidebarOpen}
          minimized={minimized}
          muted={muted}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          label={config.label}
          canGoBack={!isFirstStep || !!step.backAction}
          canGoNext={!isLastStep || !!step.forwardAction}
          isTransitioning={isTransitioning}
          onOpenSidebar={() => setSidebarOpen(true)}
          onToggleMute={toggleMute}
          onMinimize={minimize}
          onRestore={restore}
          onPrevious={() => {
            void runPreviousStep();
          }}
          onNext={() => {
            void runCurrentStep();
          }}
          onReopen={reopen}
        />
      )}

      {active && !isMobile && !minimized && (
        <DemoTourLaunchers
          isActive={active}
          isMobile={false}
          sidebarOpen={sidebarOpen}
          minimized={minimized}
          muted={muted}
          stepIndex={stepIndex}
          totalSteps={steps.length}
          label={config.label}
          canGoBack={!isFirstStep || !!step.backAction}
          canGoNext={!isLastStep || !!step.forwardAction}
          isTransitioning={isTransitioning}
          onOpenSidebar={() => setSidebarOpen(true)}
          onToggleMute={toggleMute}
          onMinimize={minimize}
          onRestore={restore}
          onPrevious={() => {
            void runPreviousStep();
          }}
          onNext={() => {
            void runCurrentStep();
          }}
          onReopen={reopen}
        />
      )}
    </div>
  );
}
