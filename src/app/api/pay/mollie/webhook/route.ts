// src/app/api/pay/mollie/webhook/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import createMollieClient from "@mollie/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const debug = process.env.DEBUG_MOLLIE_WEBHOOK === "1";
const dlog = (...args: any[]) => debug && console.log("[mollie-webhook]", ...args);

function mapMollieToPaymentStatus(mollieStatus: string) {
  // Prisma enum (from your seed): UNPAID | PENDING | PAID | FAILED | EXPIRED | CANCELED
  // Mollie payment statuses typically: open | pending | paid | failed | expired | canceled
  switch (String(mollieStatus || "").toLowerCase()) {
    case "paid":
      return "PAID" as const;
    case "pending":
    case "open":
      return "PENDING" as const;
    case "failed":
      return "FAILED" as const;
    case "expired":
      return "EXPIRED" as const;
    case "canceled":
    case "cancelled":
      return "CANCELED" as const;
    default:
      return "PENDING" as const;
  }
}

async function readMolliePaymentId(req: NextRequest) {
  // Mollie usually POSTs a body like: id=tr_xxx
  // But sometimes it can arrive as query param (depends on how it’s sent/tested)
  const urlId = req.nextUrl.searchParams.get("id");
  if (urlId) return urlId;

  const raw = await req.text();
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  return params.get("id") || null;
}

export async function POST(req: NextRequest) {
  try {
    const mollieApiKey = process.env.MOLLIE_API_KEY;
    if (!mollieApiKey) {
      console.error("[mollie-webhook] Missing MOLLIE_API_KEY");
      return new NextResponse("Missing MOLLIE_API_KEY", { status: 500 });
    }

    const molliePaymentId = await readMolliePaymentId(req);
    dlog("hit", { molliePaymentId });

    if (!molliePaymentId) {
      dlog("missing molliePaymentId");
      return new NextResponse("Missing id", { status: 400 });
    }

    const mollie = createMollieClient({ apiKey: mollieApiKey });
    const payment: any = await mollie.payments.get(molliePaymentId);

    const mollieStatus = String(payment?.status ?? "");
    const newPaymentStatus = mapMollieToPaymentStatus(mollieStatus);

    dlog("payment", {
      id: payment?.id,
      status: mollieStatus,
      mapped: newPaymentStatus,
    });

    const existing = await prisma.order.findFirst({
      where: { molliePaymentId: payment.id },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paidAt: true,
      },
    });

    if (!existing) {
      // Webhooks can arrive before we persist the payment id, or for old payments.
      dlog("order not found for molliePaymentId", payment.id);
      return new NextResponse("ok", { status: 200 });
    }

    const update: any = {
      paymentStatus: newPaymentStatus,
    };

    // Set paidAt only once when it becomes PAID
    if (newPaymentStatus === "PAID" && !existing.paidAt) {
      update.paidAt = new Date();
    }

    // ✅ THIS is the missing dispatch fix:
    // When payment becomes PAID, move order.status from NEW -> PAID (but do not overwrite OFD/DELIVERED/CANCELLED)
    if (newPaymentStatus === "PAID" && existing.status === "NEW") {
      update.status = "PAID";
    }

    // Only write if something actually changes (keeps noise down)
    const willChange =
      update.paymentStatus !== existing.paymentStatus ||
      (update.paidAt && !existing.paidAt) ||
      (update.status && update.status !== existing.status);

    if (willChange) {
      await prisma.order.update({
        where: { id: existing.id },
        data: update,
      });
      dlog("updated", { orderId: existing.id, update });
    } else {
      dlog("no change", { orderId: existing.id });
    }

    return new NextResponse("ok", { status: 200 });
  } catch (err) {
    console.error("[mollie-webhook] ERROR", err);
    // Mollie will retry if non-2xx; return 200 if you prefer “never retry”.
    return new NextResponse("error", { status: 500 });
  }
}
