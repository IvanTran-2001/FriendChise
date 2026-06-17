import { resolveSeedNamespace } from "@/lib/seed-namespace";

export function ensureTestRunNamespace(): string {
  return resolveSeedNamespace();
}

export const TEST_RUN_NAMESPACE = ensureTestRunNamespace();
