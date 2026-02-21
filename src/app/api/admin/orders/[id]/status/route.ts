import { NextResponse, type NextRequest } from "next/server";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

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
      return null;
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ Next.js 16 signature
) {
  const { id } = await context.params; // ✅ MUST await params

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

  if (updated.customerEmail && mailerStatus) {
    try {
      await sendCustomerStatusUpdateEmail({
        to: updated.customerEmail,
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        customerName: updated.customerName ?? undefined,
        postcode: updated.postcode ?? undefined,
        status: mailerStatus,
      });
    } catch (e) {
      console.error("sendCustomerStatusUpdateEmail failed", e);
    }
  }

  return NextResponse.json({ ok: true, order: updated });
}
