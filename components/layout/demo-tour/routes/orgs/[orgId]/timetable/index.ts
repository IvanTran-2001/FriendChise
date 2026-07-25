/**
 * Timetable-level demo tour config.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "Open page sidebar",
      description: "",
      desktopTarget: "page-sidebar-expand",
      mobileTarget: "page-sidebar",
      backAction: {
        type: "navigate",
        href: "__history_back__",
      },
      forwardAction: {
        type: "click-target",
        target: "page-sidebar-expand",
        waitForTarget: "page-sidebar",
      },
      advanceWhenTargetVisible: "page-sidebar",
      retreatWhenTargetNotVisible: "page-sidebar-expand",
    },
    {
      title: "Page sidebar",
      description:
        "This page sidebar controls how you view the timetable and contains navigations to actions.",
      desktopTarget: "page-sidebar",
      mobileTarget: "page-sidebar",
      backAction: {
        type: "click-target",
        target: "page-sidebar-collapse",
        waitForTarget: "page-sidebar-expand",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "page-sidebar",
    },
    {
      title: "Open Add Task",
      description: "Open Add Task in the sidebar.",
      desktopTarget: ["timetable-add-task", "add-task-panel"],
      mobileTarget: ["timetable-add-task", "add-task-panel"],
      backAction: {
        type: "click-target",
        target: "action-sidebar-close",
        waitForTarget: "page-sidebar",
      },
      forwardAction: {
        type: "click-target",
        target: "timetable-add-task",
        waitForTarget: "add-task-panel",
      },
      advanceWhenTargetVisible: "add-task-panel",
      retreatWhenTargetNotVisible: "page-sidebar",
    },
    {
      title: "Add task by dragging",
      description:
        "Use this panel to add a task to the timetable, whether you drag it in or schedule it manually.",
      desktopTarget: "add-task-panel",
      mobileTarget: "add-task-panel",
      backAction: {
        type: "click-target",
        target: "action-sidebar-close",
        waitForTarget: "page-sidebar",
      },
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "add-task-panel",
      advanceWhenEvent: "friendchise:timetable-entry-created",
    },
    {
      title: "Quick Access",
      description:
        "Quick access to information. Good for training people and keeping things consistent.",
      desktopTarget: "timetable-fry-morning-batches-open-task",
      mobileTarget: "timetable-fry-morning-batches-open-task",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "timetable-fry-morning-batches-open-task",
    },
    {
      title: "Filters",
      description:
        "Use these controls to narrow down what appears in the timetable page sidebar. For example, experienced staff can filter to the view they need while trainees keep more of the full context.",
      desktopTarget: "page-filters-panel",
      mobileTarget: "page-filters-panel",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "page-filters-panel",
    },
    {
      title: "Apply Template",
      description:
        "Use this when each period changes, so you can reduce redundancy and keep seasonal operations in sync without rebuilding the timetable by hand.",
      desktopTarget: ["timetable-apply-template", "timetable-templates-navitem"],
      mobileTarget: ["timetable-apply-template", "timetable-templates-navitem"],
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "timetable-apply-template",
    },
    {
      title: "Let's go to the task list page",
      description: "",
      desktopTarget: "sidebar-tasks",
      mobileTarget: "sidebar-tasks",
      backAction: null,
      forwardAction: {
        type: "click-target",
        target: "sidebar-tasks",
        waitForTarget: "workspace",
      },
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: "sidebar-tasks",
    },
  ],
};
