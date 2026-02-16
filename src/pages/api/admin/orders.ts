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
  const n =
    typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseIdsParam(input: unknown): string[] {
  const raw =
    typeof input === "string"
      ? input
      : Array.isArray(input) && typeof input[0] === "string"
      ? input[0]
      : "";

  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const prisma = getPrisma();

    const ids = parseIdsParam(req.query.ids);

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const takeRaw = Array.isArray(req.query.take) ? req.query.take[0] : req.query.take;
    const take = Math.min(Math.max(toInt(takeRaw, 50), 1), 200);

    const where: any = {};

    if (ids.length > 0) {
      where.id = { in: ids };
    } else {
      if (status) where.status = status;

      if (q) {
        where.OR = [
          { id: { contains: q } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { postcode: { contains: q, mode: "insensitive" } },
          { orderNumber: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const rows = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: ids.length > 0 ? Math.min(ids.length, 200) : take,
    });

    const mapped = rows.map(toAdminOrder);

    // Preserve selection order for /admin/print?ids=...
    const ordered =
      ids.length > 0
        ? (ids.map((id) => mapped.find((o) => o.id === id)).filter(Boolean) as AdminOrder[])
        : mapped;

    return res.status(200).json({ ok: true, orders: ordered });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ? String(err.message) : "Internal Server Error",
    });
  }
}