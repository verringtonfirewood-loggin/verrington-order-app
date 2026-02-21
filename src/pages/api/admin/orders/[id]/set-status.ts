import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { sendCustomerStatusUpdateEmail } from "@/lib/mailer";

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
      return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ ok: false, error: "Missing id" });

  const nextStatus = String((req.body as any)?.status ?? "").toUpperCase() as AllowedStatus;

  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ ok: false, error: `Invalid status: ${nextStatus}` });
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

  // ✅ FIX: pass both id + orderNumber to mailer
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
      // Don’t fail request on email failure
    }
  }

  return res.status(200).json({ ok: true, order: updated });
}
