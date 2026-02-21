// src/app/api/admin/db-info/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function checkBasicAuth(req: NextRequest) {
  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASS || "";

  // If you haven't set ADMIN_USER/ADMIN_PASS, don't expose DB info.
  if (!user || !pass) return false;

  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("basic ")) return false;

  try {
    const b64 = auth.slice(6).trim();
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return false;
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    return u === user && p === pass;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!checkBasicAuth(req)) return unauthorized();

  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const parsed = (() => {
      try {
        const u = new URL(dbUrl);
        return {
          host: u.hostname,
          port: u.port || "3306",
          databaseFromUrl: u.pathname.replace(/^\//, ""),
        };
      } catch {
        return { host: null, port: null, databaseFromUrl: null };
      }
    })();

    // Query the server for the CURRENT database + host/port
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port"
    )) as any[];

    const info = rows?.[0] || {};

    // Also check whether the `orders` table exists (this is the problem we’re chasing)
    const tables = (await prisma.$queryRawUnsafe(
      "SHOW TABLES"
    )) as any[];

    const tableNames = tables.map((r) => String(Object.values(r)[0]));
    const hasOrders = tableNames.includes("orders");

    return NextResponse.json({
      ok: true,
      envUrl: parsed,
      server: {
        db: info.db ?? null,
        host: info.host ?? null,
        port: info.port ?? null,
      },
      tables: {
        count: tableNames.length,
        hasOrders,
        sample: tableNames.slice(0, 25),
      },
    });
  } catch (e: any) {
    console.error("db-info error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "db-info failed" },
      { status: 500 }
    );
  }
}
