import type { NextApiRequest, NextApiResponse } from "next";
import { getPrisma } from "@/lib/prisma";
import { isAuthed, unauthorized } from "@/lib/adminAuth";

type ApiOk = { ok: true; order: AdminOrder };
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

function toAdminOrder(raw: any): AdminOrder {
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

  if (typeof raw.subtotalPence === "number") mapped.subtotalPence = raw.subtotalPence;
  if (typeof raw.deliveryFeePence === "number") mapped.deliveryFeePence = raw.deliveryFeePence;

  return mapped;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiOk | ApiErr>) {
  try {
    if (!isAuthed(req)) return unauthorized(res);

    const prisma = getPrisma();
    const id = typeof req.query.id === "string" ? req.query.id : "";

    if (!id) return res.status(400).json({ ok: false, error: "Invalid order id" });

    if (req.method === "GET") {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { items: true }, // NO product relation
      });

      if (!order) return res.status(404).json({ ok: false, error: "Order not found" });

      return res.status(200).json({ ok: true, order: toAdminOrder(order) });
    }

    if (req.method === "PATCH") {
      // Minimal safe patch: allow status + orderNumber updates (extend if you want)
      const { status, orderNumber } = (req.body ?? {}) as {
        status?: unknown;
        orderNumber?: unknown;
      };

      const data: any = {};
      if (typeof status === "string" && status.trim()) data.status = status.trim();
      if (orderNumber === null) data.orderNumber = null;
      if (typeof orderNumber === "string") data.orderNumber = orderNumber.trim();

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ ok: false, error: "No valid fields to update" });
      }

      const updated = await prisma.order.update({
        where: { id },
        data,
        include: { items: true }, // keep shape consistent
      });

      return res.status(200).json({ ok: true, order: toAdminOrder(updated) });
    }

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error("/api/admin/orders/[id] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ? String(err.message) : "Internal Server Error",
    });
  }
}
