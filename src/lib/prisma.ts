// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function mysqlUrlToAdapterConfig(databaseUrl: string) {
  const u = new URL(databaseUrl);
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

function getDatabaseUrl(): string {
  const v = process.env.DATABASE_URL;

  // Treat your placeholder as "not configured"
  if (!v || v.includes("mysql://USER:PASSWORD@HOST:PORT/DATABASE")) {
    throw new Error(
      "DATABASE_URL is missing/placeholder. Set a real MySQL URL in .env (for CLI) and .env.local (for dev), and in Vercel env vars."
    );
  }

  return v;
}

function createPrismaClient() {
  const databaseUrl = getDatabaseUrl();
  const adapter = new PrismaMariaDb(mysqlUrlToAdapterConfig(databaseUrl));
  return new PrismaClient({ adapter });
}

/**
 * Call this inside request handlers (API routes / server actions).
 * It avoids build-time failures by not requiring DB access at import time.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Default export for convenience (seed scripts, one-off scripts, etc.)
 * This is still lazy because it calls getPrisma().
 */
export default getPrisma();
