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
    case "authorized":
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

const debug = process.env.DEBUG_MOLLIE_WEBHOOK === "1";
const dlog = (...args: any[]) => debug && console.log("[mollie-webhook]", ...args);

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const molliePaymentId = params.get("id");

    dlog("hit", { raw, molliePaymentId });

    if (!molliePaymentId) {
      dlog("missing molliePaymentId");
      return NextResponse.json({ received: true });
    }

    const prisma = await getPrisma();
    const mollie = getMollie();

    const payment = await mollie.payments.get(molliePaymentId);
    const orderId = (payment.metadata as any)?.orderId as string | undefined;

    dlog("payment", {
      paymentId: payment.id,
      status: payment.status,
      orderId,
      checkout: payment?._links?.checkout?.href,
      metadata: payment.metadata,
    });

    if (!orderId) {
      dlog("missing orderId in metadata");
      return NextResponse.json({ received: true });
    }

    const newStatus = mapMollieStatus(payment.status);
    const checkoutUrl = payment?._links?.checkout?.href;

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, paymentStatus: true, paidAt: true },
    });

    dlog("existing", existing);

    if (!existing) {
      dlog("order not found");
      return NextResponse.json({ received: true });
    }

    const update: any = {
      paymentStatus: newStatus,
      molliePaymentId: payment.id,
    };

    if (newStatus === "PAID" && !existing.paidAt) {
      update.paidAt = new Date();
    }
    if (checkoutUrl) {
      update.mollieCheckoutUrl = checkoutUrl;
    }

    dlog("updating", update);

    await prisma.order.update({
      where: { id: orderId },
      data: update,
    });

    dlog("updated OK");
    return NextResponse.json({ received: true });
  } catch (err) {
    // This is the key: if Prisma/enum/DB is failing, you’ll finally see it in Vercel logs.
    console.error("[mollie-webhook] ERROR", err);
    return NextResponse.json({ received: true });
  }
}
