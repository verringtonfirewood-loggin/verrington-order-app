// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function mysqlUrlToAdapterConfig(databaseUrl: string) {
  const u = new URL(databaseUrl);

  // Railway is usually mysql://user:pass@host:port/db
  const database = u.pathname.replace(/^\//, "");

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    connectionLimit: 5,
  };
}

const adapter = new PrismaMariaDb(
  mysqlUrlToAdapterConfig(process.env.DATABASE_URL!)
);

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
