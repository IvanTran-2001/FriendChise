/**
 * Demo tour config for `/orgs/invite`.
 */
import type { DemoTourConfig } from "@/components/layout/demo-tour/types";

export const demoTourConfig: DemoTourConfig = {
	routeKey: "app",
	label: "User overview",
	steps: [
		{
			title: "[todo] Invite a user",
			description: "[todo] Check the invite flow. The unique part here is the invite form and sharing flow.",
			desktopTarget: "workspace",
			mobileTarget: "workspace",
			backAction: null,
			forwardAction: null,
			advanceWhenTargetVisible: null,
			retreatWhenTargetNotVisible: null,
		},
	],
};