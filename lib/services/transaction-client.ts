import { prisma, type PrismaTransactionClient } from "@/lib/platform/prisma";

export function supportsTransactionClient(client: PrismaTransactionClient | typeof prisma): client is typeof prisma {
  return typeof (client as { $transaction?: unknown }).$transaction === "function";
}