// src/app/api/admin/orders/[id]/status/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

// Your mailer expects: paid | out-for-delivery | delivered | cancelled
function mapToMailerStatus(s: AllowedStatus): string | null {
  switch (s) {
    case "PAID":
      return "paid";
    case "OFD":
      return "out-for-delivery";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    default:
      return null; // NEW -> no customer email by default
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const id = ctx.params.id;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const nextStatus = String(body?.status ?? "").toUpperCase() as AllowedStatus;

  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    return NextResponse.json(
      { ok: false, error: `Invalid status: ${nextStatus}` },
      { status: 400 }
    );
  }

  // Update and return the fields we need for UX + emails
  const updated = await prisma.order.update({
    where: { id },
    data: { status: nextStatus },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      postcode: true,
      customerName: true,
      customerEmail: true,
    },
  });

  const mailerStatus = mapToMailerStatus(nextStatus);

  // Send customer status email if we have an email and a mapped status
  if (updated.customerEmail && mailerStatus) {
    try {
      await sendCustomerStatusUpdateEmail({
        to: updated.customerEmail,
        orderId: updated.id, // ✅ MUST be the DB id
        orderNumber: updated.orderNumber, // ✅ VF-ORDER-###
        customerName: updated.customerName ?? undefined,
        postcode: updated.postcode ?? undefined,
        status: mailerStatus,
      });
    } catch (e) {
      // Don’t fail the API request if email fails
      console.error("sendCustomerStatusUpdateEmail failed", e);
    }
  }

  return NextResponse.json({ ok: true, order: updated });
}
