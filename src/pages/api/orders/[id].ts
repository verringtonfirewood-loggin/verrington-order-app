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
      items: true, // no Prisma relation to Product on OrderItem
    },
  });

  if (!order) {
    return res.status(404).json({ ok: false, error: "Order not found" });
  }

  const productIds = Array.from(new Set(order.items.map((it) => it.productId).filter(Boolean)));

  // Pull product images/names separately (works even without Prisma relation)
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, imageUrl: true, imageAlt: true },
      })
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = order.items.map((it) => {
    const p = productMap.get(it.productId);

    // Prefer snapshot name stored on the OrderItem, then fall back to Product name
    const name = (it.name?.trim() ? it.name : p?.name) ?? "Item";

    return {
      id: it.id,
      productId: it.productId,
      name,
      quantity: it.quantity,
      pricePence: it.pricePence,
      lineTotalPence: it.pricePence * it.quantity,
      imageUrl: p?.imageUrl ?? null,
      imageAlt: p?.imageAlt ?? name,
    };
  });

  // Prefer authoritative stored subtotal; fall back to calculated (should match)
  const calculatedSubtotalPence = items.reduce((sum, i) => sum + i.lineTotalPence, 0);
  const subtotalPence = typeof order.subtotalPence === "number" ? order.subtotalPence : calculatedSubtotalPence;

  return res.status(200).json({
    ok: true,
    order: {
      id: order.id,
      createdAt: order.createdAt, // or order.createdAt.toISOString() if you prefer a string
      postcode: order.postcode,
      customerName: order.customerName,

      preferredDay: order.preferredDay ?? null,
      deliveryNotes: order.deliveryNotes ?? null,

      subtotalPence,
      deliveryFeePence: order.deliveryFeePence ?? 0,
      totalPence: order.totalPence,

      items,
    },
  });
}
