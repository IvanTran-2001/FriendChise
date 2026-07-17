/**
 * Demo tour config for `/orgs/[orgId]/settings/roles`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "[todo] Role settings",
      description: "[todo] Check the role settings page. The unique part here is the role and permission setup.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};