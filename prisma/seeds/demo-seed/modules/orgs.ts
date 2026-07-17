import type { SeedPlan } from "../../seed-plan";
import { registerDonutShopASeeds } from "../../orgs/donut-shop-a/donut-shop-a";

// Demo database org fixtures are registered here.
export function registerDemoOrgSeeds(plan: SeedPlan) {
  registerDonutShopASeeds(plan);
}