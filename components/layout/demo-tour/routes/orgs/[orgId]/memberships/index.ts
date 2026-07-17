/**
 * Demo tour config for `/orgs/[orgId]/memberships`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "[todo] Memberships",
      description:
        "[todo] Check the membership page. The unique part here is the membership list and role assignments.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};
