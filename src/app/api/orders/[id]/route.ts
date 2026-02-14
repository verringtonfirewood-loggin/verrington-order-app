// src/app/api/orders/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = await getPrisma();  // ✅ define prisma FIRST

    const id = params?.id;

    if (!id) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order });

  } catch (err: any) {
    console.error("[api/orders/[id]]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
