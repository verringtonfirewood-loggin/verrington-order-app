// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true, // keep simple; add nested includes once schema confirms relations
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const items = order.items ?? [];
    const subtotalPence = items.reduce(
      (sum: number, i: any) => sum + (i.lineTotalPence ?? 0),
      0
    );

    return NextResponse.json(
      {
        ok: true,
        order: {
          ...order,
          items,
          subtotalPence,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/orders/[id] failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
