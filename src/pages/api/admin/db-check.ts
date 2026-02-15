import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  try {
    const prisma = await getPrisma();

    const [db] = await prisma.$queryRaw<Array<{ db: string }>>`SELECT DATABASE() AS db`;
    const [host] = await prisma.$queryRaw<Array<{ host: string }>>`SELECT @@hostname AS host`;
    const [port] = await prisma.$queryRaw<Array<{ port: number }>>`SELECT @@port AS port`;
    const [version] = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;

    const [countOrder] = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM \`order\`
    `;

    return res.status(200).json({
      ok: true,
      database: db?.db ?? null,
      mysqlHost: host?.host ?? null,
      mysqlPort: port?.port ?? null,
      mysqlVersion: version?.version ?? null,
      count_order_table: Number(countOrder?.c ?? 0),
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "db-check failed" });
  }
}
