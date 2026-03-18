/**
 * Singleton Prisma client for server-side database access.
 *
 * In development the client instance is attached to `globalThis` so it
 * survives Next.js hot-module reloads without exhausting the connection pool.
 * In production a fresh instance is created once per process.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter, log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
