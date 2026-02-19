// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
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

  if (!v || v.includes("mysql://USER:PASSWORD@HOST:PORT/DATABASE")) {
    throw new Error(
      "DATABASE_URL is missing/placeholder. Set a real MySQL URL in .env(.local) and in Vercel env vars."
    );
  }

  return v;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl();
  const adapter = new PrismaMariaDb(mysqlUrlToAdapterConfig(databaseUrl));
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getPrisma(): PrismaClient {
  return prisma;
}

export default prisma;
