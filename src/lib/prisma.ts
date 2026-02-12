// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Adapter: MySQL/MariaDB (Prisma recommends the MariaDB adapter for MySQL too)
const adapter = new PrismaMariaDb({
  url: process.env.DATABASE_URL!, // Railway MySQL URL
  // Optional tuning (safe to omit)
  connectionLimit: 5,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
