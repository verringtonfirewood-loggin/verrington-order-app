export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";

function requireBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_BASE_URL");
  return baseUrl.replace(/\/$/, "");
}

export async function POST(req: Request) {
  const { orderId } = await req.json().catch(() => ({}));

  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const prisma = await getPrisma();
  const mollie = getMollie();
  const baseUrl = requireBaseUrl();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.checkoutPaymentMethod !== "MOLLIE") {
    return NextResponse.json(
      { error: "Order is not set to Mollie payment" },
      { status: 409 }
    );
  }

  if (order.paymentStatus === "PAID") {
    return NextResponse.json(
      { error: "Order already paid" },
      { status: 409 }
    );
  }

  const payment = await mollie.payments.create({
    amount: {
      currency: "GBP",
      value: (order.totalPence / 100).toFixed(2),
    },
    description: `Verrington Firewood order ${order.id}`,
    redirectUrl: `${baseUrl}/pay/mollie/success?orderId=${order.id}`,
    webhookUrl: `${baseUrl}/api/pay/mollie/webhook`,
    metadata: {
      orderId: order.id,
    },
  });

  const checkoutUrl = payment?._links?.checkout?.href;

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "Mollie checkout URL missing" },
      { status: 500 }
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      molliePaymentId: payment.id,
      mollieCheckoutUrl: checkoutUrl,
      paymentStatus: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, url: checkoutUrl });
}
