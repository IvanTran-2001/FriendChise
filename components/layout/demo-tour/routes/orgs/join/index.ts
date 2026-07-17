/**
 * Demo tour config for `/orgs/join`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
	routeKey: "app",
	label: "User overview",
	steps: [
		{
			title: "[todo] Join an org",
			description: "[todo] Check the join flow. The unique part here is the invite or join-code form.",
			desktopTarget: "workspace",
			mobileTarget: "workspace",
			backAction: null,
			forwardAction: null,
			advanceWhenTargetVisible: null,
			retreatWhenTargetNotVisible: null,
		},
	],
};