/**
 * Thin structured-logging wrapper.
 *
 * All log calls route through here so the underlying backend (currently
 * Sentry structured logs) can be swapped, enriched with shared fields
 * (e.g. a request-id), or mocked in unit tests from a single place.
 *
 * Usage:
 *   import { log } from "@/lib/observability";
 *   log.info("Task created", { orgId, taskId });
 *   log.warn("Permission denied", { orgId, permission, userId });
 *   log.error("Unexpected failure", { error });
 */
import * as Sentry from "@sentry/nextjs";

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    Sentry.logger.info(msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    Sentry.logger.warn(msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    Sentry.logger.error(msg, ctx),
};
