import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";

function unauthorized(res: NextApiResponse) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
  return res.status(401).json({ ok: false, message: "Unauthorized" });
}

function parseBasicAuth(req: NextApiRequest) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const creds = parseBasicAuth(req);
  const expectedUser = process.env.ADMIN_USER || "mike";
  const expectedPass = process.env.ADMIN_PASS || "";

  if (!creds) return unauthorized(res);
  if (creds.user !== expectedUser || creds.pass !== expectedPass) return unauthorized(res);

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  if (!requireAdmin(req, res)) return;

try {
  const prisma = await getPrisma();

  const debug = req.query.debug === "1";
  let dbInfo: any = undefined;

  if (debug) {
    const [db] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
    const [host] = await prisma.$queryRaw<Array<{ host: string }>>`SELECT @@hostname AS host`;
    const [port] = await prisma.$queryRaw<Array<{ port: number }>>`SELECT @@port AS port`;
    const [version] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;
    const [countOrder] = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM \`order\`
    `;

    dbInfo = {
      database: db?.db ?? null,
      mysqlHost: host?.host ?? null,
      mysqlPort: port?.port ?? null,
      mysqlVersion: version?.version ?? null,
      count_order_table: Number(countOrder?.c ?? 0),
    };
  }

  // ... your existing q/status/take/where and prisma.order.findMany below ...

  const debug = req.query.debug === "1";

  let dbInfo: any = undefined;
  if (debug) {
    const [db] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
    const [host] = await prisma.$queryRaw<Array<{ host: string }>>`SELECT @@hostname AS host`;
    const [port] = await prisma.$queryRaw<Array<{ port: number }>>`SELECT @@port AS port`;
    const [version] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;

    // IMPORTANT: `order` is reserved, keep backticks
    const [countOrder] = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM \`order\`
    `;

    dbInfo = {
      database: db?.db ?? null,
      mysqlHost: host?.host ?? null,
      mysqlPort: port?.port ?? null,
      mysqlVersion: version?.version ?? null,
      count_order_table: Number(countOrder?.c ?? 0),
    };
  }

  // ✅ your existing query that returns orders (whatever you already have)
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    // ... existing filters, includes, etc
  });

  return res.status(200).json({
    ok: true,
    orders,
    ...(dbInfo ? { dbInfo } : {}),
  });
}

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const takeRaw = typeof req.query.take === "string" ? req.query.take : "";
    const take = Math.min(Math.max(parseInt(takeRaw || "50", 10) || 50, 1), 200);

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { id: { contains: q } },
        { orderNumber: { contains: q } }, // ✅ if you added orderNumber
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        { customerEmail: { contains: q } },
        { postcode: { contains: q } },
        { molliePaymentId: { contains: q } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: { items: true },
    });

    return res.status(200).json({ ok: true, orders });
  } catch (err: any) {
    console.error("[api/admin/orders] error:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? "Server error" });
  }
}
