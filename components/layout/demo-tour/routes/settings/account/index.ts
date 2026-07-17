/**
 * Demo tour config for `/settings/account`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "[todo] Account preferences",
      description: "[todo] Check the account settings page. The unique part here is the personal account and security controls.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};