/**
 * Demo tour config for `/orgs/[orgId]/tasks/[taskId]/edit`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
  routeKey: "org",
  label: "Org overview",
  steps: [
    {
      title: "[todo] Edit task",
      description: "[todo] Check the task edit page. The unique part here is the editable task form.",
      desktopTarget: "workspace",
      mobileTarget: "workspace",
      backAction: null,
      forwardAction: null,
      advanceWhenTargetVisible: null,
      retreatWhenTargetNotVisible: null,
    },
  ],
};