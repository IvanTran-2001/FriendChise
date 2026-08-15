import { prisma, type PrismaTransactionClient } from "@/lib/platform/prisma";

type TransactionOptions = Parameters<typeof prisma.$transaction>[1];

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