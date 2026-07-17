import { resolveSeedNamespace } from "./seed-namespace";

export function ensureTestRunNamespace(): string {
	if (!process.env.SEED_NAMESPACE?.trim()) {
		process.env.SEED_NAMESPACE = "random";
	}

	return resolveSeedNamespace();
}

export const TEST_RUN_NAMESPACE = ensureTestRunNamespace();
