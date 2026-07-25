/**
 * Demo tour config for `/privacy`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "[todo] Privacy policy",
      description: "[todo] Check the privacy page. The unique part here is the policy content and compliance copy.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};