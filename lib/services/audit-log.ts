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

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Parses a YYYY-MM-DD string into a validated UTC Date, or returns undefined.
 */
function parseUtcDate(date: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;

  const [yearStr, monthStr, dayStr] = date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (
    year < 1000 || year > 9999 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) return undefined;

  const candidate = new Date(`${date}T00:00:00.000Z`);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return undefined;

  return candidate;
}

/**
 * Resolves a date range from explicit from/to strings or a single date string.
 */
function resolveDateRange(
  date?: string,
  dateFrom?: string,
  dateTo?: string
): { gte?: Date; lt?: Date } | undefined {
  // Explicit range takes priority
  if (dateFrom || dateTo) {
    const from = dateFrom ? parseUtcDate(dateFrom) : undefined;
    const to = dateTo ? parseUtcDate(dateTo) : undefined;

    if (from || to) {
      return {
        ...(from && { gte: from }),
        ...(to && { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) }),
      };
    }
  }

  // Single date — full day range
  const parsed = date ? parseUtcDate(date) : undefined;
  if (parsed) {
    return {
      gte: parsed,
      lt: new Date(parsed.getTime() + 24 * 60 * 60 * 1000),
    };
  }

  return undefined;
}

/**
 * Builds the shared Prisma where clause for audit log queries.
 */
function buildAuditLogWhere({
  orgId,
  search,
  date,
  dateFrom,
  dateTo,
}: {
  orgId?: string;
  search?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}): Prisma.AuditLogWhereInput {
  const dateRange = resolveDateRange(date, dateFrom, dateTo);

  return {
    ...(orgId && { orgId }),
    ...(search && {
      OR: [
        { action: { contains: search, mode: "insensitive" } },
        { actorEmail: { contains: search, mode: "insensitive" } },
        { targetType: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(dateRange && {
      createdAt: dateRange,
    }),
  };
}

// ─── Exported functions ─────────────────────────────────────────────────────

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
 * Returns the total count of audit logs for an org, with optional filters.
 */
export async function getAuditLogsCount(
  orgId: string = "",
  { search, date, dateFrom, dateTo }: { search?: string; date?: string; dateFrom?: string; dateTo?: string } = {}
) {
  return prisma.auditLog.count({
    where: buildAuditLogWhere({ orgId, search, date, dateFrom, dateTo }),
  });
}

/**
 * Returns the audit log for an org, newest-first.
 * `limit` defaults to 50 — callers can paginate by adjusting this.
 */
export async function getAuditLogs(
  orgId: string = "",
  { search, date, dateFrom, dateTo, limit = 50, page = 1 }: { search?: string; date?: string; dateFrom?: string; dateTo?: string; limit?: number; page?: number } = {}
) {
  return prisma.auditLog.findMany({
    where: buildAuditLogWhere({ orgId, search, date, dateFrom, dateTo }),
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: (page - 1) * limit,
  });
}
