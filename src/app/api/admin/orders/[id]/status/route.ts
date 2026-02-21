// src/app/api/admin/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(x: unknown): x is AllowedStatus {
  return typeof x === "string" && (ALLOWED_STATUSES as readonly string[]).includes(x);
}

// Your mailer expects: paid | out-for-delivery | delivered | cancelled
function mapUiStatusToMailer(status: AllowedStatus): "paid" | "out-for-delivery" | "delivered" | "cancelled" | null {
  switch (status) {
    case "PAID":
      return "paid";
    case "OFD":
      return "out-for-delivery";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    default:
      return null;
  }
}

type PatchBody = {
  status?: unknown;
  cancelReason?: unknown;
  clearCancel?: unknown;
  archived?: unknown;
  unarchive?: unknown;
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const update: Record<string, any> = {};

    // Status change (optional)
    if (body.status !== undefined) {
      if (!isAllowedStatus(body.status)) {
        return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
      update.status = body.status;
    }

    // Cancel / clear-cancel
    if (body.clearCancel === true) {
      update.cancelledAt = null;
      update.cancelReason = null;
      // Only set NEW if caller didn't explicitly pick another status
      if (!update.status) update.status = "NEW";
    }

    if (update.status === "CANCELLED") {
      update.cancelledAt = new Date();
      if (body.cancelReason !== undefined) {
        update.cancelReason =
          typeof body.cancelReason === "string" && body.cancelReason.trim()
            ? body.cancelReason.trim()
            : null;
      }
    } else if (body.cancelReason !== undefined) {
      // allow updating cancel reason without forcing status
      update.cancelReason =
        typeof body.cancelReason === "string" && body.cancelReason.trim()
          ? body.cancelReason.trim()
          : null;
    }

    // Archive / unarchive
    if (body.archived === true) update.archivedAt = new Date();
    if (body.unarchive === true) update.archivedAt = null;

    const updated = await prisma.order.update({
      where: { id },
      data: update,
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        postcode: true,
        status: true,
        orderNumber: true,
        archivedAt: true,
        cancelledAt: true,
        cancelReason: true,
      },
    });

    // Email customer on key status transitions (only if email exists)
    const mailerStatus = mapUiStatusToMailer(updated.status as AllowedStatus);
    if (mailerStatus && updated.customerEmail) {
      await sendCustomerStatusUpdateEmail({
        to: updated.customerEmail,
        orderId: updated.id,
        orderNumber: updated.orderNumber ?? null,
        customerName: updated.customerName,
        postcode: updated.postcode ?? "—",
        status: mailerStatus,
      });
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to update order" },
      { status: 500 }
    );
  }
}
