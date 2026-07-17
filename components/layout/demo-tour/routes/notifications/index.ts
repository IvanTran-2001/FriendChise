/**
 * Demo tour config for `/notifications`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "[todo] Notification center",
      description: "[todo] Check the notifications page. The unique part here is the activity feed and alerts list.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};