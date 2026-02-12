import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

function safeId(id: unknown) {
  return typeof id === "string" && id.length >= 10 && id.length <= 64;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const id = req.query.id;
  if (!safeId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid order id" });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ ok: false, error: "Order not found" });
  }

  const items = order.items.map((it) => ({
    id: it.id,
    productId: it.productId,
    name: it.product?.name ?? (it as any).productName ?? "Item",
    quantity: it.quantity,
    pricePence: it.pricePence,
    lineTotalPence: it.pricePence * it.quantity,
    imageUrl: it.product?.imageUrl ?? null,
    imageAlt: it.product?.imageAlt ?? null,
  }));

  const subtotalPence = items.reduce((sum, i) => sum + i.lineTotalPence, 0);

  return res.status(200).json({
    ok: true,
    order: {
      id: order.id,
      createdAt: order.createdAt,
      customerName: order.customerName,
      postcode: order.postcode,

      // If/when you store these on Order, they’ll appear automatically:
      preferredDay: (order as any).preferredDay ?? null,
      deliveryNotes: (order as any).deliveryNotes ?? null,
      deliveryFeePence: (order as any).deliveryFeePence ?? null,
      totalPence: (order as any).totalPence ?? null,

      items,
      subtotalPence,
    },
  });
}
