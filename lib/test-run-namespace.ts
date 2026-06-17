import crypto from "crypto";

export function ensureTestRunNamespace(): string {
  if (process.env.SEED_NAMESPACE?.trim()) {
    return process.env.SEED_NAMESPACE.trim();
  }

  const namespace = `run-${crypto.randomUUID().slice(0, 8)}`;
  process.env.SEED_NAMESPACE = namespace;
  return namespace;
}

export const TEST_RUN_NAMESPACE = ensureTestRunNamespace();
