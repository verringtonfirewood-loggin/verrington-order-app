// src/app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            // IMPORTANT: only keep this if your schema has OrderItem -> Product relation
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order }, { status: 200 });
  } catch (err) {
    console.error("GET /api/orders/[id] failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
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
