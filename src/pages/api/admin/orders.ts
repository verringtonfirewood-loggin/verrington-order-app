import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const takeRaw = req.query.take;
    const take =
      typeof takeRaw === "string" && Number.isInteger(Number(takeRaw))
        ? Math.max(1, Math.min(200, Number(takeRaw)))
        : 50;

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { items: true },
    });

    return res.status(200).json({ ok: true, orders });
  } catch (err: any) {
    console.error("GET /api/admin/orders failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
