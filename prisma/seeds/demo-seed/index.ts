import type { SeedPlan } from "../seed-plan";
import { registerDemoAfterOrgSeeds } from "./modules/after-org";
import { registerDemoOrgSeeds } from "./modules/orgs";
import { registerDemoUserSeeds } from "./modules/users";

// Demo seed hub: this folder defines the data that makes up the demo database.
export function registerDemoSeedModules(plan: SeedPlan) {
  registerDemoUserSeeds(plan);
  registerDemoOrgSeeds(plan);
  registerDemoAfterOrgSeeds(plan);
}