// src/app/api/admin/orders/[id]/archive/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;

    const updated = await prisma.order.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, orderId: updated.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Archive failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;

    const updated = await prisma.order.update({
      where: { id },
      data: { archivedAt: null },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, orderId: updated.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unarchive failed" },
      { status: 500 }
    );
  }
}
