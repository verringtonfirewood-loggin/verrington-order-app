// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

type ExtendedPrisma = ReturnType<PrismaClient["$extends"]>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | ExtendedPrisma | undefined;
};

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

function makeAdapterClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl();
  const adapter = new PrismaMariaDb(mysqlUrlToAdapterConfig(databaseUrl));
  return new PrismaClient({ adapter });
}

function makeAccelerateClient(): ExtendedPrisma {
  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;
  if (!accelerateUrl) {
    throw new Error(
      "PRISMA_ACCELERATE_URL is missing. Prisma v7 client engine requires accelerateUrl or an adapter."
    );
  }

  const base = new PrismaClient({
    accelerateUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends(withAccelerate());
}

function makeClient(): PrismaClient | ExtendedPrisma {
  // Prefer Accelerate when configured
  if (process.env.PRISMA_ACCELERATE_URL) return makeAccelerateClient();
  // Fallback to adapter (dev / local / environments without accelerate)
  return makeAdapterClient();
}

/**
 * Call this inside request handlers (API routes / server actions).
 * It avoids multiple clients in dev and keeps a single instance.
 */
export function getPrisma(): PrismaClient | ExtendedPrisma {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = makeClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Named export used across the app.
 * Note: This creates the client at import time.
 * If you want *zero* import-time risk, use `getPrisma()` everywhere instead.
 */
export const prisma = getPrisma();

export default prisma;
