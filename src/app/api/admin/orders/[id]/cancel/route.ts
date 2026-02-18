// src/app/api/admin/orders/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: body?.reason?.trim() ? body.reason.trim() : null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, orderId: updated.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Cancel failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // "Restore" (uncancel) — does NOT guess previous status; returns to NEW.
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "NEW",
        cancelledAt: null,
        cancelReason: null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, orderId: updated.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Restore failed" },
      { status: 500 }
    );
  }
}
