// src/app/api/admin/orders/[id]/status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const id = params.id;

    const update: any = {};

    if (body.status) update.status = body.status;
    if (body.cancelReason !== undefined)
      update.cancelReason = body.cancelReason || null;

    if (body.status === "CANCELLED") {
      update.cancelledAt = new Date();
    }

    if (body.clearCancel) {
      update.cancelledAt = null;
      update.cancelReason = null;
      update.status = "NEW";
    }

    if (body.archived) {
      update.archivedAt = new Date();
    }

    if (body.unarchive) {
      update.archivedAt = null;
    }

    const order = await prisma.order.update({
      where: { id },
      data: update,
    });

    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
