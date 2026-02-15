import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";

/**
 * Basic Auth check
 */
function isAuthorized(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Basic ")) return false;

  const base64 = auth.split(" ")[1];
  const decoded = Buffer.from(base64, "base64").toString("utf8");

  const [user, pass] = decoded.split(":");

  return (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Area"');
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  try {
    const prisma = await getPrisma();

    // ✅ Debug toggle
    const debug = req.query.debug === "1";
    let dbInfo: any = undefined;

    if (debug) {
      const [db] = await prisma.$queryRaw<Array<{ db: string }>>`
        SELECT DATABASE() AS db
      `;

      const [host] = await prisma.$queryRaw<Array<{ host: string }>>`
        SELECT @@hostname AS host
      `;

      const [port] = await prisma.$queryRaw<Array<{ port: number }>>`
        SELECT @@port AS port
      `;

      const [version] = await prisma.$queryRaw<Array<{ version: string }>>`
        SELECT VERSION() AS version
      `;

      const [countOrder] = await prisma.$queryRaw<Array<{ c: bigint }>>`
  SELECT COUNT(*) AS c FROM verrington_orders.\`order\`
`;

      dbInfo = {
        database: db?.db ?? null,
        mysqlHost: host?.host ?? null,
        mysqlPort: port?.port ?? null,
        mysqlVersion: version?.version ?? null,
        count_order_table: Number(countOrder?.c ?? 0),
      };
    }

    // ✅ Query filters
    const q =
      typeof req.query.q === "string" ? req.query.q.trim() : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const take =
      typeof req.query.take === "string"
        ? parseInt(req.query.take, 10)
        : 50;

    const where: any = {};

    if (q) {
      where.OR = [
        { orderNumber: { contains: q } },
        { customerName: { contains: q } },
        { customerEmail: { contains: q } },
        { postcode: { contains: q } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // ✅ Main orders query
    const orders = await prisma.order.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
      },
    });

    return res.status(200).json({
      ok: true,
      orders,
      ...(dbInfo ? { dbInfo } : {}),
    });
  } catch (e: any) {
    console.error("Admin Orders Error:", e);
    return res.status(500).json({
      ok: false,
      message: "Internal Server Error",
      error: e?.message ?? null,
    });
  }
}
