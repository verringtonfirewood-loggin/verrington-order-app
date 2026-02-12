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
  items: OrderItem[];
};

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return `£${gbp.toFixed(2)}`;
}

export default function ThanksPage() {
const sp = useSearchParams();
const orderId = sp?.get("orderId") ?? null;


  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!orderId) return;
      setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Failed to load order");
        }

        if (!cancelled) setOrder(data.order);
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
    return order.subtotalPence + (typeof deliveryFeePence === "number" ? deliveryFeePence : 0);
  }, [order, deliveryFeePence]);

  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-3xl border p-8 shadow-sm" style={{ background: "var(--vf-surface)" }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[var(--vf-muted)]">Verrington Firewood</div>
              <h1 className="mt-2 text-3xl font-extrabold">Order received</h1>
              <p className="mt-2 text-[var(--vf-muted)]">
                We’ll confirm delivery day (and any delivery charge) by text shortly.
              </p>
            </div>

            <Link
              href="/"
              className="hidden sm:inline-flex rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-black/5"
            >
              Back home
            </Link>
          </div>

          {/* Reference */}
          <div className="mt-6 rounded-2xl border p-4">
            <div className="text-sm text-[var(--vf-muted)]">Order reference</div>
            <div className="mt-1 font-mono text-sm break-all">{orderId ?? "—"}</div>
          </div>

          {/* Loading / error */}
          {loading ? (
            <div className="mt-6 rounded-2xl border p-4 text-sm text-[var(--vf-muted)]">
              Loading your order…
            </div>
          ) : err ? (
            <div className="mt-6 rounded-2xl border p-4 text-sm text-red-700">
              Couldn’t load your order summary: {err}
            </div>
          ) : null}

          {/* Summary */}
          {order ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
              <section>
                <h2 className="text-lg font-extrabold">Your items</h2>

                <div className="mt-4 space-y-3">
                  {order.items.map((i) => (
                    <div key={i.id} className="rounded-3xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="relative h-12 w-14 overflow-hidden rounded-2xl border bg-black/[0.03] shrink-0">
                            <Image
                              src={i.imageUrl || "/products/placeholder.jpg"}
                              alt={i.imageAlt ?? i.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold">{i.name}</div>
                            <div className="mt-1 text-sm text-[var(--vf-muted)]">
                              {i.quantity} × {formatGBPFromPence(i.pricePence)}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 font-semibold">
                          {formatGBPFromPence(i.lineTotalPence)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl border p-5 text-sm">
                  <div className="font-bold">Delivery details</div>
                  <div className="mt-2 text-[var(--vf-muted)]">
                    <div>
                      <span className="font-semibold text-[var(--vf-text)]">Postcode:</span>{" "}
                      {order.postcode}
                    </div>
                    {order.preferredDay ? (
                      <div className="mt-1">
                        <span className="font-semibold text-[var(--vf-text)]">Preferred day:</span>{" "}
                        {order.preferredDay}
                      </div>
                    ) : null}
                    {order.deliveryNotes ? (
                      <div className="mt-2">
                        <span className="font-semibold text-[var(--vf-text)]">Notes:</span>{" "}
                        {order.deliveryNotes}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <aside>
                <div className="sticky top-6 rounded-3xl border p-6" style={{ background: "var(--vf-surface)" }}>
                  <h2 className="text-lg font-extrabold">Totals</h2>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--vf-muted)]">Subtotal</span>
                      <span className="font-semibold">{formatGBPFromPence(order.subtotalPence)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[var(--vf-muted)]">Delivery</span>
                      <span className="font-semibold">
                        {typeof deliveryFeePence === "number"
                          ? formatGBPFromPence(deliveryFeePence)
                          : "To be confirmed"}
                      </span>
                    </div>

                    <div className="mt-3 border-t pt-3 flex justify-between">
                      <span className="font-bold">Total</span>
                      <span className="text-lg font-extrabold">
                        {typeof deliveryFeePence === "number" || typeof order.totalPence === "number"
                          ? formatGBPFromPence(computedTotalPence)
                          : formatGBPFromPence(order.subtotalPence)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-[var(--vf-muted)]">
                      We’ll confirm delivery day and any delivery charge by text.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-3">
                    <Link
                      href="/order"
                      className="rounded-2xl px-6 py-3 text-sm font-semibold text-center"
                      style={{ background: "var(--vf-primary)", color: "var(--vf-primary-contrast)" }}
                    >
                      Place another order
                    </Link>

                    <Link
                      href="/"
                      className="rounded-2xl border px-6 py-3 text-sm font-semibold text-center hover:bg-black/5"
                    >
                      Back home
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
