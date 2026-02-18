// src/app/api/admin/orders/[id]/husbandry/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const logs = await prisma.husbandryLog.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        note: true,
        author: true,
      },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (err: any) {
    console.error("GET /api/admin/orders/[id]/husbandry error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      note?: string;
      author?: string | null;
    };

    const note = (body.note ?? "").toString().trim();
    if (!note) {
      return NextResponse.json({ ok: false, error: "Note is required." }, { status: 400 });
    }

    const created = await prisma.husbandryLog.create({
      data: {
        orderId: id,
        note,
        author: body.author ? body.author.toString().trim() : null,
      },
      select: {
        id: true,
        createdAt: true,
        note: true,
        author: true,
      },
    });

    return NextResponse.json({ ok: true, log: created });
  } catch (err: any) {
    console.error("POST /api/admin/orders/[id]/husbandry error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
