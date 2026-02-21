// src/app/thanks/ThanksClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GoogleRatingBadge from "@/components/GoogleRatingBadge";

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

type OrderPayload = {
  id: string;
  orderNumber?: string | null;

  createdAt: string;
  postcode: string;
  customerName: string;
  preferredDay?: string | null;
  deliveryNotes?: string | null;
  deliveryFeePence?: number | null;
  totalPence?: number | null;
  subtotalPence: number;

  checkoutPaymentMethod: "MOLLIE" | "BACS" | "CASH";
  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "CANCELED";

  mollieCheckoutUrl?: string | null;
  items?: any[];
};

type GoogleRatingResp = {
  ok: boolean;
  name?: string;
  rating?: number | null;
  count?: number | null;
  mapsUrl?: string | null;
  reviewUrl?: string | null;
  attribution?: string;
  error?: string;
};

function formatGBPFromPence(pence: number) {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

function StarRow({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span aria-label={`${rating} stars`} className="tracking-wide">
      {"★".repeat(full)}
      {"☆".repeat(Math.max(0, 5 - full))}
    </span>
  );
}

function RatingPill({ rating, count }: { rating: number; count?: number | null }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold vf-animate-fade-in-up"
      style={{ background: "rgba(255,255,255,0.45)" }}
      title={typeof count === "number" ? `${count} Google reviews` : "Google rating"}
    >
      <span className="opacity-80">Rated</span>
      <span className="font-extrabold">{rating.toFixed(1)}</span>
      <StarRow rating={rating} />
      <span className="opacity-80">on Google</span>
      {typeof count === "number" ? (
        <span className="text-[var(--vf-muted)]">({count})</span>
      ) : null}
    </div>
  );
}

export default function ThanksClient() {
  const sp = useSearchParams();
  const orderId = useMemo(() => sp?.get("orderId") ?? "", [sp]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [startingPay, setStartingPay] = useState(false);

  const [gr, setGr] = useState<GoogleRatingResp | null>(null);

  const displayRef = useMemo(() => {
    return order?.orderNumber ?? orderId;
  }, [order?.orderNumber, orderId]);

  // Load Google rating for the inline pill (cached at API layer)
  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/google-rating")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setGr(d);
      })
      .catch(() => {
        if (!cancelled) setGr({ ok: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: any = null;

    async function load(showSpinner = true) {
      if (!orderId) {
        setOrder(null);
        return;
      }

      if (showSpinner) setLoading(true);
      setErr(null);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        const data = await safeJson(res);

        if (!res.ok || !data || (data as any)?.ok !== true) {
          throw new Error((data as any)?.error ?? "Failed to load order");
        }

        const nextOrder = (data as any).order as OrderPayload;

        if (!cancelled) setOrder(nextOrder);

        if (
          !cancelled &&
          nextOrder.checkoutPaymentMethod === "MOLLIE" &&
          nextOrder.paymentStatus === "PENDING"
        ) {
          timer = setTimeout(() => load(false), 2500);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load order");
        if (!cancelled) timer = setTimeout(() => load(false), 4000);
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    load(true);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const deliveryFeePence = order?.deliveryFeePence ?? 0;

  const computedTotalPence = useMemo(() => {
    if (!order) return 0;
    if (typeof order.totalPence === "number") return order.totalPence;
    return (order.subtotalPence ?? 0) + (deliveryFeePence ?? 0);
  }, [order, deliveryFeePence]);

  const isPaid = order?.paymentStatus === "PAID";

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

      const data = await safeJson(res);

      if (!res.ok || !data || !(data as any)?.url) {
        throw new Error((data as any)?.error ?? "Failed to start payment");
      }

      window.location.href = (data as any).url;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start payment");
    } finally {
      setStartingPay(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Branded header */}
        <header className="flex items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Verrington Firewood"
              className="h-12 w-12 rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight">
                Verrington Firewood
              </div>
              <div className="text-sm text-[var(--vf-muted)]">
                South Somerset &amp; North Dorset
              </div>
            </div>
          </div>

          <Link
            href="/order"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:-translate-y-[1px] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--vf-primary)",
              color: "var(--vf-primary-contrast)",
            }}
          >
            Order again
          </Link>
        </header>

        {/* Hero / thank you */}
        <section
          className="mt-6 overflow-hidden rounded-[28px] border shadow-sm vf-animate-fade-in-up"
          style={{ background: "var(--vf-surface)" }}
        >
          <div
            className="p-8 md:p-10"
            style={{
              background:
                "radial-gradient(1200px 400px at 20% 0%, rgba(34,197,94,0.12), transparent 60%)," +
                "linear-gradient(135deg, rgba(120,53,15,0.10), transparent 55%)," +
                "linear-gradient(0deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02))",
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-extrabold tracking-tight">
                  Thank you — order received
                </h1>

                {gr?.ok && typeof gr.rating === "number" ? (
                  <RatingPill rating={gr.rating} count={gr.count} />
                ) : null}
              </div>

              <p className="text-sm text-[var(--vf-muted)]">
                We’ve got it. We’ll confirm your delivery day and keep you updated.
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border bg-white/50 px-4 py-2 text-sm">
                <span className="text-[var(--vf-muted)]">Reference</span>
                <span className="font-mono font-semibold">{displayRef}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            {loading && (
              <p className="mt-1 text-sm text-[var(--vf-muted)]">Loading order…</p>
            )}
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

            {order && (
              <div className="grid gap-6 md:grid-cols-5">
                {/* Left: payment + totals */}
                <div className="md:col-span-3">
                  <div
                    className={[
                      "rounded-3xl border p-5 transition-shadow",
                      isPaid ? "vf-animate-glow" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">Payment</div>
                        <div className="mt-1 text-sm text-[var(--vf-muted)]">
                          Method: {order.checkoutPaymentMethod}
                        </div>
                        <div className="text-sm text-[var(--vf-muted)]">
                          Status: {order.paymentStatus}
                        </div>
                      </div>

                      {/* Status pill */}
                      <div
                        className="rounded-2xl border px-3 py-1 text-xs font-semibold"
                        style={{
                          background: isPaid
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(0,0,0,0.03)",
                        }}
                      >
                        {isPaid ? "PAID ✅" : "IN PROGRESS"}
                      </div>
                    </div>

                    {order.checkoutPaymentMethod === "MOLLIE" && (
                      <div className="mt-4">
                        {isPaid ? (
                          <div className="rounded-2xl border px-4 py-3">
                            <div className="text-green-700 font-semibold">
                              Payment received ✅
                            </div>
                            <div className="mt-1 text-xs text-[var(--vf-muted)]">
                              Thank you — we’ll schedule your delivery.
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-[var(--vf-muted)]">
                              Secure online payment (Card / Apple Pay)
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {order.mollieCheckoutUrl ? (
                                <a
                                  href={order.mollieCheckoutUrl}
                                  className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-black/5"
                                >
                                  Resume payment
                                </a>
                              ) : (
                                <button
                                  onClick={startMolliePayment}
                                  disabled={startingPay}
                                  className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-black/5 disabled:opacity-50"
                                >
                                  {startingPay ? "Starting…" : "Pay now"}
                                </button>
                              )}

                              <Link
                                href="/"
                                className="inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold hover:bg-black/5"
                              >
                                Back home
                              </Link>
                            </div>

                            {order.paymentStatus === "PENDING" && (
                              <p className="mt-3 text-xs text-[var(--vf-muted)] animate-pulse">
                                Checking payment status…
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {order.checkoutPaymentMethod === "BACS" && (
                      <div className="mt-4 rounded-2xl border px-4 py-3">
                        <p className="text-sm text-[var(--vf-muted)]">
                          Please transfer{" "}
                          <span className="font-semibold">
                            {formatGBPFromPence(computedTotalPence)}
                          </span>{" "}
                          Reference:{" "}
                          <span className="font-mono font-semibold">{displayRef}</span>
                        </p>
                      </div>
                    )}

                    {order.checkoutPaymentMethod === "CASH" && (
                      <div className="mt-4 rounded-2xl border px-4 py-3">
                        <p className="text-sm text-[var(--vf-muted)]">
                          Payment will be taken on delivery.
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between rounded-2xl border px-4 py-3">
                      <span className="text-sm text-[var(--vf-muted)]">Total</span>
                      <span className="text-lg font-extrabold">
                        {formatGBPFromPence(computedTotalPence)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-4 text-sm">
                    <Link href="/order" className="font-semibold hover:underline">
                      Place another order
                    </Link>
                    <Link href="/" className="font-semibold hover:underline">
                      Back home
                    </Link>
                  </div>
                </div>

                {/* Right: next steps / reassurance */}
                <div className="md:col-span-2">
                  <div className="rounded-3xl border p-5">
                    <div className="text-sm font-bold">What happens next</div>

                    <ol className="mt-3 space-y-3 text-sm text-[var(--vf-muted)]">
                      <li className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold">
                          1
                        </span>
                        <span>We’ll review your order and confirm your delivery day.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold">
                          2
                        </span>
                        <span>We’ll keep you updated so you know when to expect us.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold">
                          3
                        </span>
                        <span>We deliver ready-to-burn firewood to your doorstep.</span>
                      </li>
                    </ol>

                    <div className="mt-4 rounded-2xl border bg-white/50 px-4 py-3">
                      <div className="text-xs font-semibold">Need to change something?</div>
                      <div className="mt-1 text-xs text-[var(--vf-muted)]">
                        Reply to your confirmation email, or contact us and quote your reference.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border p-5">
                    <div className="text-sm font-bold">Thanks for supporting local</div>
                    <p className="mt-2 text-sm text-[var(--vf-muted)]">
                      Your order helps keep logs moving in South Somerset &amp; North Dorset — we
                      really appreciate it.
                    </p>
                  </div>

                  {/* ⭐ Review CTA */}
                  <div className="mt-4 vf-animate-fade-in-up">
                    <div className="mb-2 text-sm font-bold">How did we do?</div>
                    <p className="mb-3 text-sm text-[var(--vf-muted)]">
                      If everything’s spot on, a quick Google review really helps 🙏
                    </p>
                    <GoogleRatingBadge />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-8 text-center text-xs text-[var(--vf-muted)]">
          © {new Date().getFullYear()} Verrington Firewood
        </footer>
      </div>
    </main>
  );
}
