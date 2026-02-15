import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";
import { isAuthed, unauthorized } from "@/lib/adminAuth";

type ApiOk = { ok: true; orders: AdminOrder[] };
type ApiErr = { ok: false; error: string };

type AdminOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  pricePence: number;
};

type AdminOrder = {
  id: string;
  createdAt: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  postcode: string;
  totalPence: number;
  subtotalPence?: number;
  deliveryFeePence?: number;
  orderNumber: string | null;
  items: AdminOrderItem[];
};

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function toAdminOrder(raw: any): AdminOrder {
  // We intentionally do NOT rely on any Product relation.
  const itemsRaw: any[] = Array.isArray(raw?.items) ? raw.items : [];

  const mapped: AdminOrder = {
    id: String(raw.id),
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    status: String(raw.status ?? "NEW"),
    customerName: String(raw.customerName ?? ""),
    customerPhone: String(raw.customerPhone ?? ""),
    customerEmail: String(raw.customerEmail ?? ""),
    postcode: String(raw.postcode ?? ""),
    totalPence: Number(raw.totalPence ?? 0),
    orderNumber: raw.orderNumber == null ? null : String(raw.orderNumber),
    items: itemsRaw.map((it) => ({
      id: String(it.id),
      productId: it.productId == null ? null : String(it.productId),
      name: String(it.name ?? ""),
      quantity: Number(it.quantity ?? 0),
      pricePence: Number(it.pricePence ?? 0),
    })),
  };

  // Include these ONLY if they exist on the DB record (no schema coupling).
  if (typeof raw.subtotalPence === "number") mapped.subtotalPence = raw.subtotalPence;
  if (typeof raw.deliveryFeePence === "number") mapped.deliveryFeePence = raw.deliveryFeePence;

  return mapped;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  try {
    if (!isAuthed(req)) return unauthorized(res);

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const prisma = getPrisma();

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const takeRaw = Array.isArray(req.query.take) ? req.query.take[0] : req.query.take;
    const take = Math.min(Math.max(toInt(takeRaw, 50), 1), 200);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (q) {
      // Search across common admin fields. Keep it simple + robust.
      // NOTE: If a field doesn't exist in your Prisma schema, Prisma will error.
      // These are very likely present given your admin UI needs.
      where.OR = [
        { id: { contains: q } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { postcode: { contains: q, mode: "insensitive" } },
        { orderNumber: { contains: q, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        items: true, // NO product relation
      },
    });

    return res.status(200).json({
      ok: true,
      orders: orders.map(toAdminOrder),
    });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ? String(err.message) : "Internal Server Error",
    });
  }
}
