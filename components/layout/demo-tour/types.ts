/**
 * Shared types for demo tour configs and steps.
 */
export type DemoTourStepAction =
  | {
      type: "click-target";
      target: string;
      waitForTarget?: string | string[];
    }
  | {
      type: "navigate";
      href: string;
    };

export type DemoTourStep = {
  title: string;
  description: string;
  desktopTarget: string | string[];
  mobileTarget?: string | string[];
  backAction: DemoTourStepAction | null;
  forwardAction: DemoTourStepAction | null;
  advanceWhenTargetVisible: string | string[] | null;
  retreatWhenTargetNotVisible: string | string[] | null;
  advanceWhenEvent?: string | null;
};

export type DemoTourConfig = {
  routeKey: "app" | "org";
  label: string;
  steps: DemoTourStep[];
};
