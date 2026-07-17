/**
 * Demo tour config for `/orgs/new`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
	routeKey: "app",
	label: "User overview",
	steps: [
		{
			title: "[todo] Create a new org",
			description: "[todo] Check the page that creates a new org. The unique part here is the org creation form.",
			desktopTarget: "workspace",
			mobileTarget: "workspace",
			backAction: null,
			forwardAction: null,
			advanceWhenTargetVisible: null,
			retreatWhenTargetNotVisible: null,
		},
	],
};