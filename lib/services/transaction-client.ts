import { Prisma } from "@prisma/client";
import { prisma, type PrismaTransactionClient } from "@/lib/platform/prisma";

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

export function supportsTransactionClient(client: PrismaTransactionClient | typeof prisma): client is typeof prisma {
  return typeof (client as { $transaction?: unknown }).$transaction === "function";
}

export async function runInTransaction<T>(
  client: PrismaTransactionClient | typeof prisma,
  write: (db: PrismaTransactionClient | typeof prisma) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  if (supportsTransactionClient(client)) {
    return (client as typeof prisma).$transaction((transactionClient) => write(transactionClient), options);
  }

  return write(client);
}