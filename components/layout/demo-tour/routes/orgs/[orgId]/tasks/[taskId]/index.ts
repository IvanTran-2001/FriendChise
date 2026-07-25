/**
 * Demo tour config for `/orgs/[orgId]/tasks/[taskId]`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "Task description",
      description:
        "This shows the full set of instructions, and it supports images and video links.",
      desktopTarget: "task-description-panel",
      mobileTarget: "task-description-panel",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Comments",
      description:
        "This is the discussion area where teams pass wisdom around to improve operations, recipes, or anything else. The tour will scroll it into view so it stays on screen.",
      desktopTarget: "task-comments-panel",
      mobileTarget: "task-comments-panel",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Open page sidebar",
      description:
        "Make sure the page sidebar is open so we can show the sharing controls.",
      desktopTarget: "page-sidebar-expand",
      mobileTarget: "page-sidebar",
      backAction: null,
      forwardAction: {
        type: "click-target",
        target: "page-sidebar-expand",
        waitForTarget: "page-sidebar",
      },
      advanceWhenTargetVisible: "page-sidebar",
      retreatWhenTargetNotVisible: "page-sidebar-expand",
    },
    {
      title: "Sharing",
      description:
        "This is how we enable sharing between franchises.",
      desktopTarget: "task-sharing-panel",
      mobileTarget: "task-sharing-panel",
      backAction: {
        type: "click-target",
        target: "page-sidebar-collapse",
        waitForTarget: "page-sidebar-expand",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Purpose",
      description:
        "This is what keeps every location consistent. If everyone knows these details, each franchise can operate at its highest level.",
      desktopTarget: "task-summary-panel",
      mobileTarget: "task-summary-panel",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};