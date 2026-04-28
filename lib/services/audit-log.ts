/**
 * Audit log service.
 *
 * logAudit  — write a single log entry. Pass the transaction client `db` when
 *             inside a Prisma transaction so the log commits atomically with
 *             the mutation; pass `prisma` for standalone (non-transactional)
 *             calls and fire-and-forget with .catch() so a log failure never
 *             blocks the main operation.
 *
 * getAuditLogs — read log entries for an org, newest-first.
 *
 * ─── Checklist for new service mutations ────────────────────────────────────
 * When adding a new service function that mutates data, ask:
 *
 *  1. Is it a significant business action? (not a status bump, join-table
 *     write, or cascade side-effect — think "would an org owner care?")
 *     → If yes, add a logAudit call. If no, skip it.
 *
 *  2. Is the mutation inside a $transaction?
 *     → Yes: pass `tx` to logAudit so the log is atomic with the mutation.
 *     → No:  pass `prisma` and chain .catch((err) => log.warn(...)) so a
 *            log failure never surfaces as a user-facing error.
 *
 *  3. Does the function need a before snapshot?
 *     → For updates/deletes: fetch the record before mutating and pass it
 *       as `before`. For creates, omit `before` (leave null).
 *
 *  4. Add `actorId?: string | null` to the service function signature and
 *     pass `authz.userId` from the calling action/API route.
 *
 *  5. Name the action as "<entity>.<verb>" in lowercase, e.g.:
 *     "org.update", "role.delete", "invite.send", "bot.create"
 * ────────────────────────────────────────────────────────────────────────────
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// Re-derives the transaction client type so this module has no runtime
// dependency on franchise.ts while staying in sync with Prisma's types.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const auditLogInputSchema = z.object({
  orgId: z.string().cuid(),
  actorId: z.string().cuid().nullish(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  // JSON blobs originate from our own DB reads — validate shape, not deep types
  before: z.record(z.string(), z.unknown()).nullish(),
  after: z.record(z.string(), z.unknown()).nullish(),
});

export type AuditLogInput = z.infer<typeof auditLogInputSchema>;

/**
 * Writes an audit log entry.
 *
 * When called inside a transaction, pass the transaction client so the log is
 * committed atomically with the mutation it describes. When called outside a
 * transaction, pass `prisma` and chain `.catch()` so a log write failure never
 * surfaces as a user-facing error.
 */
export function logAudit(db: Tx, entry: AuditLogInput) {
  const parsed = auditLogInputSchema.parse(entry);
  return db.auditLog.create({
    data: {
      orgId: parsed.orgId,
      actorId: parsed.actorId ?? null,
      action: parsed.action,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      before: (parsed.before as Prisma.InputJsonObject | null | undefined) ?? Prisma.JsonNull,
      after: (parsed.after as Prisma.InputJsonObject | null | undefined) ?? Prisma.JsonNull,
    },
  });
}

/**
 * Returns the audit log for an org, newest-first, with actor details inlined.
 * `limit` defaults to 100 — callers can paginate by adjusting this and
 * supplying a cursor once a UI is built.
 */
export async function getAuditLogs(orgId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { orgId },
    include: {
      actor: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
