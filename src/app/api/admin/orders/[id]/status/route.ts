// src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ALLOWED_STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(s: unknown): s is AllowedStatus {
  return typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      cancelReason?: string | null;
      archived?: boolean;
      unarchive?: boolean;
      clearCancel?: boolean;
    };

    const data: any = {};

    // Status change
    if (body.status !== undefined) {
      if (!isAllowedStatus(body.status)) {
        return NextResponse.json(
          { ok: false, error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      data.status = body.status;

      // If cancelling, set cancelledAt (and require/allow a reason)
      if (body.status === "CANCELLED") {
        data.cancelledAt = new Date();
        data.cancelReason = (body.cancelReason ?? "").toString().trim() || null;
      }
    }

    // Explicit cancel fields (if you ever call without status)
    if (body.cancelReason !== undefined) {
      data.cancelReason = body.cancelReason ? body.cancelReason.toString().trim() : null;
    }

    // Clear cancel (re-open)
    if (body.clearCancel) {
      data.cancelledAt = null;
      data.cancelReason = null;
      // If currently CANCELLED and you "clearCancel", default back to NEW unless caller sets status explicitly
      if (!data.status) data.status = "NEW";
    }

    // Archive / unarchive
    if (body.archived) data.archivedAt = new Date();
    if (body.unarchive) data.archivedAt = null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No changes provided." },
        { status: 400 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        cancelledAt: true,
        cancelReason: true,
        archivedAt: true,
      },
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (err: any) {
    console.error("PATCH /api/admin/orders/[id]/status error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
