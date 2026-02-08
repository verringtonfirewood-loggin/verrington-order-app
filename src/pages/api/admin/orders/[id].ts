import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = [
  "pending",
  "confirmed",
  "out-for-delivery",
  "delivered",
  "cancelled",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(s: unknown): s is AllowedStatus {
  return typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) return res.status(400).json({ error: "Missing order id" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body: any = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const status = body?.status;

    if (!isAllowedStatus(status)) {
      return res.status(400).json({
        error: "Invalid status",
        allowed: ALLOWED_STATUSES,
      });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });

    return res.status(200).json({ ok: true, order: updated });
  } catch (err: any) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return res.status(500).json({ ok: false, message: err?.message ?? String(err) });
  }
}
