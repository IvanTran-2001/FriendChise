/**
 * Audit log service.
 *
 * recordAudit — write a single log entry. Always fire-and-forget: errors are
 *               captured via Sentry and never propagated to the caller.
 *               Call sites do NOT need .catch() or try/catch.
 *
 * getAuditLogs — read log entries for an org, newest-first.
 *
 * ─── Checklist for new service mutations ────────────────────────────────────
 * When adding a new service function that mutates data, ask:
 *
 *  1. Is it a significant business action? (not a status bump, join-table
 *     write, or cascade side-effect — think "would an org owner care?")
 *     → If yes, call recordAudit. If no, skip it.
 *
 *  2. Does the function need a before snapshot?
 *     → For updates/deletes: fetch the record before mutating and pass it
 *       as `before`. For creates, omit `before` (leave null).
 *
 *  3. Add `actorId?: string | null` to the service function signature and
 *     pass `authz.userId` from the calling action/API route.
 *
 *  4. Name the action as "<entity>.<verb>" in lowercase, e.g.:
 *     "org.update", "role.delete", "invite.send", "bot.create"
 * ────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { log } from "@/lib/observability";
import { Prisma, PrismaClient } from "@prisma/client";

export interface AuditLogInput {
  orgId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
}

/**
 * Returns a sanitized subset of audit params safe for error logging.
 * Omits potentially large/sensitive fields (before, after, metadata).
 */
function sanitizeAuditParams(params: AuditLogInput) {
  return {
    orgId: params.orgId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    actorEmail: params.actorEmail
      ? `${params.actorEmail.substring(0, 3)}***`
      : null,
  };
}

/**
 * Writes an audit log entry. When called outside a transaction, errors are
 * swallowed and logged. When called within a transaction (client is provided),
 * errors are rethrown to allow the transaction to roll back.
 *
 * @param params - Audit log entry data
 * @param client - Optional Prisma client or transaction handle. When provided,
 *                 the audit write is part of the same transaction. When omitted,
 *                 uses the root prisma client.
 */
export async function recordAudit(
  params: AuditLogInput,
  client?: PrismaClient | Prisma.TransactionClient,
): Promise<void> {
  const db = client ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        orgId: params.orgId,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before:
          (params.before as Prisma.InputJsonObject | null | undefined) ??
          Prisma.JsonNull,
        after:
          (params.after as Prisma.InputJsonObject | null | undefined) ??
          Prisma.JsonNull,
        metadata:
          (params.metadata as Prisma.InputJsonObject | null | undefined) ??
          Prisma.JsonNull,
      },
    });
  } catch (error) {
    // If we're in a transaction, rethrow so the outer transaction can roll back
    if (client) {
      throw error;
    }
    // Otherwise, log the failure and swallow it so the user's mutation succeeds
    log.error("Audit log write failed", {
      error,
      params: sanitizeAuditParams(params),
    });
  }
}

/**
 * Returns the audit log for an org, newest-first.
 * `limit` defaults to 100 — callers can paginate by adjusting this.
 */
export async function getAuditLogs(orgId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
