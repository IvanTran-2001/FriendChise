/**
 * Org-level demo tour config.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "Open page sidebar",
      description:
        "Open the page sidebar to control how you see the timetable.",
      desktopTarget: "page-sidebar-expand",
      mobileTarget: "timetable-page-sidebar",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: {
        type: "click-target",
        target: "page-sidebar-expand",
        waitForTarget: "timetable-page-sidebar",
      },
      advanceWhenTargetVisible: "timetable-page-sidebar",
      retreatWhenTargetNotVisible: "timetable-page-sidebar",
    },
    {
      title: "Page sidebar",
      description:
        "This page sidebar controls how you view the timetable and contains navigations to actions.",
      desktopTarget: "timetable-page-sidebar",
      mobileTarget: "timetable-page-sidebar",
      backAction: {
        type: "click-target",
        target: "page-sidebar-collapse",
        waitForTarget: "page-sidebar-expand",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "timetable-page-sidebar",
    },    {
      title: "Open Add Task",
      description:
        "Open Add Task in the sidebar.",
      desktopTarget: ["timetable-add-task", "add-task-panel"],
      mobileTarget: ["timetable-add-task", "add-task-panel"],
      backAction: {
        type: "click-target",
        target: "action-sidebar-close",
        waitForTarget: "timetable-page-sidebar",
      },
      forwardAction: {
        type: "click-target",
        target: "timetable-add-task",
        waitForTarget: "add-task-panel",
      },
      advanceWhenTargetVisible: "add-task-panel",
      retreatWhenTargetNotVisible: "timetable-page-sidebar",
    },
    {
      title: "Add task by dragging",
      description:
        "Use this panel to choose the task and time.",
      desktopTarget: "add-task-panel",
      mobileTarget: "add-task-panel",
      backAction: {
        type: "click-target",
        target: "action-sidebar-close",
        waitForTarget: "timetable-page-sidebar",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "add-task-panel",
      advanceWhenEvent: "friendchise:timetable-placement-completed",
    },
    {
      title: "Apply Template",
      description:
        "Allows reusable templates for cycles and repeated timetable setups.",
      desktopTarget: "timetable-apply-template",
      mobileTarget: "timetable-apply-template",
      backAction: null,
      forwardAction: {
        type: "click-target",
        target: "timetable-apply-template",
        waitForTarget: "apply-template-panel",
      },
      advanceWhenTargetVisible: "apply-template-panel",
      retreatWhenTargetNotVisible: "timetable-page-sidebar",
    },
    {
      title: "Apply Template panel",
      description:
        "Choose a reusable template, date range, and cycle repeats.",
      desktopTarget: "apply-template-panel",
      mobileTarget: "apply-template-panel",
      backAction: {
        type: "click-target",
        target: "action-sidebar-close",
        waitForTarget: "timetable-page-sidebar",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "apply-template-panel",
    },
  ],
};
