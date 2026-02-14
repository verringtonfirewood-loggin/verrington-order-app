// src/app/api/pay/mollie/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getMollie } from "@/lib/mollie";

function baseUrlFromEnv() {
  const env = (process.env.NEXT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const base = env || vercel;
  return base.replace(/\/+$/, "");
}

function isLocalhost(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function to2dpGBP(totalPence: number) {
  return (totalPence / 100).toFixed(2);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const prisma = await getPrisma();
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

const baseUrl = baseUrlFromEnv();

// Redirect can still work locally; webhook must be public/reachable
const redirectBase = baseUrl || "http://localhost:3000";
const redirectUrl = `${redirectBase}/thanks?orderId=${encodeURIComponent(orderId)}`;

// Webhook should hit Vercel (stable, no ngrok interstitial)
const webhookBase = (process.env.MOLLIE_WEBHOOK_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

const webhookUrl = webhookBase
  ? `${webhookBase}/api/pay/mollie/webhook`
  : (baseUrl && !isLocalhost(baseUrl)
      ? `${baseUrl}/api/pay/mollie/webhook`
      : undefined);

    const mollie = getMollie();

    const payment = await mollie.payments.create({
      amount: { currency: "GBP", value: to2dpGBP(order.totalPence) },
      description: `Verrington Firewood order ${orderId}`,
      redirectUrl,
      ...(webhookUrl ? { webhookUrl } : {}), // IMPORTANT: omit if localhost/missing
      metadata: { orderId },
    });

    const checkoutUrl = payment?._links?.checkout?.href;

    if (!payment?.id || !checkoutUrl) {
      return NextResponse.json(
        { ok: false, error: "Mollie did not return checkout URL" },
        { status: 502 }
      );
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        molliePaymentId: payment.id,
        mollieCheckoutUrl: checkoutUrl,
        paymentStatus: "PENDING",
      },
    });

    return NextResponse.json({ ok: true, url: checkoutUrl });
  } catch (err: any) {
    const msg =
      err?.message ||
      err?.response?.data?.detail ||
      err?.response?.data?.title ||
      "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
