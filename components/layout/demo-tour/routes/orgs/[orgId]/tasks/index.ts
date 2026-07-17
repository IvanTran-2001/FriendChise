/**
 * Timetable-level demo tour config.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "Workspace",
      description:
        "The workspace is good for recipe work, operations, and quick information lookups.",
      desktopTarget: ["workspace"],
      mobileTarget: "workspace",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
    {
      title: "Open page sidebar",
      description: "",
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
      title: "Filter",
      description:
        "Good to organize post. For example, recipe, operations and other information tagging",
      desktopTarget: ["page-filters-panel"],
      mobileTarget: "page-filters-panel",
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
      title: "Search and select \"Fry Morning Batches\"",
      description:
        "Use the search bar to look up \"Fry Morning Batches\", then pick the matching task from the results.",
      desktopTarget: ["task-toolbar-search", "task-fry-morning-batches"],
      mobileTarget: ["task-toolbar-search", "task-fry-morning-batches"],
      backAction: null,
      forwardAction: {
        type: "click-target",
        target: "task-fry-morning-batches",
        waitForTarget: "task-view-actions",
      },
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};
