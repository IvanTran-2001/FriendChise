/**
 * Demo tour config for `/orgs`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "[todo] Your organizations",
      description: "[todo] Check the orgs list page. The unique part here is the org cards and membership overview.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};