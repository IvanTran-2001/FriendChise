/**
 * Hub-level demo tour config.
 */
import type { DemoTourConfig } from "../types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "app",
  label: "User overview",
  steps: [
    {
      title: "Create an org or join as a franchisee",
      description:
        "Click the Org button in the sidebar to create or join as a franchisee.",
      desktopTarget: "sidebar-org",
      mobileTarget: "sidebar-org",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "This is your overview page",
      description:
        "List of orgs you have membership to.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Open Donut Shop A",
      description:
        "Click the Donut Shop A card to go to the org page.",
      desktopTarget: ["org-selector", "org-card-donut-shop-a", "org-selector-item-donut-shop-a"],
      mobileTarget: ["org-selector", "org-card-donut-shop-a", "org-selector-item-donut-shop-a"],
      backAction: null,
      forwardAction: {
        type: "click-target",
        target: "org-card-donut-shop-a",
        waitForTarget: "workspace",
      },
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};
