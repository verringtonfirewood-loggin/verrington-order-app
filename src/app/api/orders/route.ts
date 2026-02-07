export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      createdAtIso: o.createdAt.toISOString(),
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerEmail: o.customerEmail ?? undefined,
      postcode: o.postcode,
      total: o.totalPence / 100,
      status: o.status,
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.pricePence / 100,
        quantity: i.quantity,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const customerEmail = body.customerEmail ? String(body.customerEmail).trim() : null;
  const postcode = String(body.postcode ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !customerPhone || !postcode || items.length === 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const safeItems = items.map((i: any) => ({
    productId: String(i.productId ?? "").trim(),
    name: String(i.name ?? "").trim(),
    pricePence: Math.round(Number(i.price ?? 0) * 100),
    quantity: Math.max(1, Math.floor(Number(i.quantity ?? 1))),
  }));

  const totalPence = safeItems.reduce((sum, i) => sum + i.pricePence * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone,
      customerEmail,
      postcode,
      totalPence,
      status: "pending",
      items: { create: safeItems },
    },
  });

  return NextResponse.json({ ok: true, orderId: order.id });
}
