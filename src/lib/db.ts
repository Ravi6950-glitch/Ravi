import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client for the process.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit until SQLite refuses them.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
