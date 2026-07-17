import type { SeedPlan } from "../../seed-plan";
import { registerSeedUsers } from "../../shared/users";

// Demo database user fixtures come from the shared seed user set.
export function registerDemoUserSeeds(plan: SeedPlan) {
  registerSeedUsers(plan);
}