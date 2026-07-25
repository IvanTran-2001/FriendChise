/**
 * Org-level demo tour config.
 */
import type { DemoTourConfig } from "../../../types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "Org Mode",
      description:
        "Use the sidebar to navigate to utilities.",
      desktopTarget: "app-sidebar",
      mobileTarget: "sidebar-toggle",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Overview happens here",
      description:
        `This page is the overview for __ORG_NAME__. The page content is where the interactions happen, so you can see the whole org at a glance and drill into the important parts from here.`,
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Timetable",
      description:
        "Click Timetable in the sidebar to open the timetable page.",
      desktopTarget: "sidebar-timetable",
      mobileTarget: "sidebar-timetable",
      forwardAction: {
        type: "click-target",
        target: "sidebar-timetable",
        waitForTarget: "page-sidebar-expand",
      },
      backAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};
