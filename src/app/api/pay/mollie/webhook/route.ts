export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";

type AppPaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELED";

function mapMollieStatus(status?: string): AppPaymentStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "authorized": // treat as paid/secured; you can change to PENDING if you prefer
      return "PAID";
    case "canceled":
      return "CANCELED";
    case "expired":
      return "EXPIRED";
    case "failed":
      return "FAILED";
    case "pending":
    case "open":
    default:
      return "PENDING";
  }
}

export async function POST(req: Request) {
  try {
    // Mollie usually posts "id=tr_xxx" as form-encoded
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const molliePaymentId = params.get("id");

    if (!molliePaymentId) {
      return NextResponse.json({ received: true });
    }

    const prisma = await getPrisma();
    const mollie = getMollie();

    const payment = await mollie.payments.get(molliePaymentId);
    const orderId = (payment.metadata as any)?.orderId as string | undefined;

    if (!orderId) {
      return NextResponse.json({ received: true });
    }

    const newStatus = mapMollieStatus(payment.status);
    const checkoutUrl = payment?._links?.checkout?.href;

    // Fetch existing order so we can do idempotent updates (paidAt)
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, paidAt: true },
    });

    if (!existing) {
      // Order doesn't exist (deleted / wrong metadata) — ACK so Mollie doesn't retry forever
      return NextResponse.json({ received: true });
    }

    const update: any = {
      paymentStatus: newStatus,
      molliePaymentId: payment.id,
    };

    // Only set paidAt once (first time we see PAID)
    if (newStatus === "PAID" && !existing.paidAt) {
      update.paidAt = new Date();
    }

    // Optional: keep latest checkout link (useful for "resume payment" UX)
    if (checkoutUrl) {
      update.mollieCheckoutUrl = checkoutUrl;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: update,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    // IMPORTANT: always ACK webhooks to avoid repeated retries due to transient issues.
    // If you want logging:
    // console.error("Mollie webhook error:", err);
    return NextResponse.json({ received: true });
  }
}
