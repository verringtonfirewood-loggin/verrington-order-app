// src/app/api/admin/orders/bulk/route.ts
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type Action = "cancel" | "restore" | "archive" | "unarchive";

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const body = (await req.json()) as { action: Action; ids: string[]; reason?: string };

    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "No ids" }, { status: 400 });

    const action = body?.action;
    if (!action) return NextResponse.json({ ok: false, error: "No action" }, { status: 400 });

    if (action === "cancel") {
      const reason = body?.reason?.trim() ? body.reason.trim() : null;
      const r = await prisma.order.updateMany({
        where: { id: { in: ids } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
      });
      return NextResponse.json({ ok: true, updated: r.count });
    }

    if (action === "restore") {
      const r = await prisma.order.updateMany({
        where: { id: { in: ids } },
        data: { status: "NEW", cancelledAt: null, cancelReason: null },
      });
      return NextResponse.json({ ok: true, updated: r.count });
    }

    if (action === "archive") {
      const r = await prisma.order.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt: new Date() },
      });
      return NextResponse.json({ ok: true, updated: r.count });
    }

    if (action === "unarchive") {
      const r = await prisma.order.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt: null },
      });
      return NextResponse.json({ ok: true, updated: r.count });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Bulk action failed" },
      { status: 500 }
    );
  }
}
