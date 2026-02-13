"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  pricePence: number;
  lineTotalPence: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

type OrderPayload = {
  id: string;
  createdAt: string;
  postcode: string;
  customerName: string;
  preferredDay?: string | null;
  deliveryNotes?: string | null;
  deliveryFeePence?: number | null;
  totalPence?: number | null;
  subtotalPence: number;

  checkoutPaymentMethod: "MOLLIE" | "BACS" | "CASH";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED";

  mollieCheckoutUrl?: string | null;

  items: OrderItem[];
};

function formatGBPFromPence(pence: number) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

export default function ThanksClient() {
  const sp = useSearchParams();
  const orderId = useMemo(() => sp?.get("orderId") ?? "", [sp]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [startingPay, setStartingPay] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!orderId) {
        setOrder(null);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Failed to load order");
        }

        if (!cancelled) setOrder(data.order as OrderPayload);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const deliveryFeePence = order?.deliveryFeePence ?? null;

  const computedTotalPence = useMemo(() => {
    if (!order) return 0;
    if (typeof order.totalPence === "number") return order.totalPence;
    return order.subtotalPence + (deliveryFeePence ?? 0);
  }, [order, deliveryFeePence]);

  async function startMolliePayment() {
    if (!orderId) return;

    try {
      setStartingPay(true);
      setErr(null);

      const res = await fetch("/api/pay/mollie/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to start payment");

      window.location.href = data.url;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start payment");
    } finally {
      setStartingPay(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div
          className="rounded-3xl border p-8 shadow-sm"
          style={{ background: "var(--vf-surface)" }}
        >
          <h1 className="text-3xl font-extrabold">Order received</h1>

          <div className="mt-4 text-sm text-[var(--vf-muted)]">
            Reference: <span className="font-mono">{orderId}</span>
          </div>

          {loading && <p className="mt-4 text-sm">Loading order…</p>}
          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}

          {order && (
            <>
              {/* Payment block */}
              <div className="mt-6 rounded-3xl border p-5 text-sm">
                <div className="font-bold">Payment</div>
                <div className="mt-2 text-[var(--vf-muted)]">
                  Method: {order.checkoutPaymentMethod}
                </div>
                <div className="text-[var(--vf-muted)]">
                  Status: {order.paymentStatus}
                </div>

                {order.checkoutPaymentMethod === "MOLLIE" && (
                  <div className="mt-3">
                    {order.paymentStatus === "PAID" ? (
                      <div className="text-green-700 font-semibold">
                        Payment received ✅
                      </div>
                    ) : (
                      <>
                        <p className="text-[var(--vf-muted)]">
                          Secure online payment (Card / Apple Pay)
                        </p>

                        {order.mollieCheckoutUrl ? (
                          <a
                            href={order.mollieCheckoutUrl}
                            className="mt-2 inline-block rounded-2xl border px-4 py-2 font-semibold hover:bg-black/5"
                          >
                            Resume payment
                          </a>
                        ) : (
                          <button
                            onClick={startMolliePayment}
                            disabled={startingPay}
                            className="mt-2 rounded-2xl border px-4 py-2 font-semibold hover:bg-black/5"
                          >
                            {startingPay ? "Starting…" : "Pay now"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {order.checkoutPaymentMethod === "BACS" && (
                  <p className="mt-3 text-[var(--vf-muted)]">
                    Please transfer {formatGBPFromPence(computedTotalPence)} using
                    reference <b>{order.id}</b>.
                  </p>
                )}

                {order.checkoutPaymentMethod === "CASH" && (
                  <p className="mt-3 text-[var(--vf-muted)]">
                    Payment will be taken on delivery.
                  </p>
                )}
              </div>

              {/* Totals */}
              <div className="mt-6 text-sm">
                Total:{" "}
                <span className="font-bold">
                  {formatGBPFromPence(computedTotalPence)}
                </span>
              </div>

              <div className="mt-6 flex gap-3">
                <Link href="/order">Place another order</Link>
                <Link href="/">Back home</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
