import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  try {
    const [db] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
    const [host] = await prisma.$queryRaw<Array<{ host: string }>>`SELECT @@hostname AS host`;
    const [port] = await prisma.$queryRaw<Array<{ port: number }>>`SELECT @@port AS port`;
    const [version] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;

    // Check both possible table names safely
    const [countOrder] = await prisma.$queryRaw<Array<{ c: bigint }>>`SELECT COUNT(*) AS c FROM \`order\``;
    const [countOrderItem] = await prisma.$queryRaw<Array<{ c: bigint }>>`SELECT COUNT(*) AS c FROM \`orderitem\``;

    return res.status(200).json({
      ok: true,
      db: db?.db ?? null,
      mysqlHost: host?.host ?? null,
      mysqlPort: port?.port ?? null,
      mysqlVersion: version?.version ?? null,
      count_order: Number(countOrder?.c ?? 0),
      count_orderitem: Number(countOrderItem?.c ?? 0),
      latest: await prisma.order.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, orderNumber: true, createdAt: true },
      }),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "db-check failed" });
  }
}
