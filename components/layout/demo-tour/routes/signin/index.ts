/**
 * Demo tour config for `/signin`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "[todo] Sign in",
      description: "[todo] Check the sign-in page. The unique part here is the authentication form.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};