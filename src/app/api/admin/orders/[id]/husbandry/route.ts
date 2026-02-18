// src/app/api/admin/orders/[id]/husbandry/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const prisma = getPrisma();
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { note?: string; author?: string };

    const note = body?.note?.trim();
    if (!note) return NextResponse.json({ ok: false, error: "Note required" }, { status: 400 });

    const author = body?.author?.trim() || "Admin";

    const log = await prisma.husbandryLog.create({
      data: { orderId: id, author, note },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: log.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Husbandry add failed" },
      { status: 500 }
    );
  }
}
