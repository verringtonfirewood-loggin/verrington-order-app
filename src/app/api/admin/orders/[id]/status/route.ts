//src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";

const ALLOWED_STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(s: unknown): s is AllowedStatus {
  return typeof s === "string" && (ALLOWED_STATUSES as readonly string[]).includes(s);
}

function toCustomerEmailStatus(adminStatus: AllowedStatus): string | null {
  // Your mailer expects: paid | out-for-delivery | delivered | cancelled
  switch (adminStatus) {
    case "PAID":
      return "paid";
    case "OFD":
      return "out-for-delivery";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "NEW":
    default:
      return null; // no customer email on NEW (safe + avoids spam)
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

      // If cancelling, set cancelledAt (and allow a reason)
      if (body.status === "CANCELLED") {
        data.cancelledAt = new Date();
        data.cancelReason = (body.cancelReason ?? "").toString().trim() || null;
      }
    }

    // Explicit cancel fields (if ever called without status)
    if (body.cancelReason !== undefined) {
      data.cancelReason = body.cancelReason ? body.cancelReason.toString().trim() : null;
    }

    // Clear cancel (re-open)
    if (body.clearCancel) {
      data.cancelledAt = null;
      data.cancelReason = null;
      if (!data.status) data.status = "NEW";
    }

    // Archive / unarchive
    if (body.archived) data.archivedAt = new Date();
    if (body.unarchive) data.archivedAt = null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No changes provided." }, { status: 400 });
    }

    // Update + fetch email-relevant fields in the same query
    const updated = await prisma.order.update({
      where: { id },
      data,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        cancelledAt: true,
        cancelReason: true,
        archivedAt: true,

        customerName: true,
        customerEmail: true,
        postcode: true,
      },
    });

    // Try customer status email — NEVER fail the PATCH if email fails
    let emailSent = false;
    let emailError: string | null = null;

    try {
      const nextStatus = updated.status as AllowedStatus;
      const emailStatus = toCustomerEmailStatus(nextStatus);

      // Only send if: status maps + customerEmail exists
      if (emailStatus && updated.customerEmail) {
        await sendCustomerStatusUpdateEmail({
          to: updated.customerEmail,
          orderId: updated.orderNumber ?? updated.id,
          customerName: updated.customerName ?? undefined,
          postcode: updated.postcode ?? undefined,
          status: emailStatus,
        });
        emailSent = true;
      }
    } catch (e: any) {
      emailSent = false;
      emailError = e?.message || "Failed to send customer status email";
      console.error("Customer status email failed:", e);
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: updated.id,
        status: updated.status,
        cancelledAt: updated.cancelledAt,
        cancelReason: updated.cancelReason,
        archivedAt: updated.archivedAt,
      },
      emailSent,
      emailError,
    });
  } catch (err: any) {
    console.error("PATCH /api/admin/orders/[id]/status error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
