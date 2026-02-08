import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const takeRaw = typeof req.query.take === "string" ? Number(req.query.take) : NaN;
    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, Math.trunc(takeRaw))) : 50;

    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : null;

    const q =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim()
        : null;

    const where: any = {};
    if (status) where.status = status;

    if (q) {
      where.OR = [
        { customerName: { contains: q } },
        { customerPhone: { contains: q } },
        { customerEmail: { contains: q } },
        { postcode: { contains: q } },
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
    console.error("GET /api/admin/orders failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
