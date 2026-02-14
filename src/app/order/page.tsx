"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description?: string;
  pricePence: number;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

function normalisePostcode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

// Gentle heuristic only (real delivery rules remain server-side)
function looksLikeInArea(postcode: string) {
  const pc = normalisePostcode(postcode);
  const outward = pc.split(" ")[0] ?? "";
  return ["BA", "DT", "SP", "TA"].some((p) => outward.startsWith(p));
}

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return `£${gbp.toFixed(2)}`;
}

export default function OrderPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [qty, setQty] = useState<Record<string, number>>({});

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [postcode, setPostcode] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<
    "MOLLIE" | "BACS" | "CASH"
  >("BACS");

  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [preferredDay, setPreferredDay] = useState(""); // yyyy-mm-dd
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- qty helpers (used in Products + Basket) ---
  function setProductQty(productId: string, nextQty: number) {
    setQty((prev) => ({
      ...prev,
      [productId]: Math.max(0, Number.isFinite(nextQty) ? nextQty : 0),
    }));
  }

  function inc(productId: string) {
    setQty((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }

  function dec(productId: string) {
    setQty((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] ?? 0) - 1),
    }));
  }

  function remove(productId: string) {
    setProductQty(productId, 0);
  }

  // Load products from DB via API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingProducts(true);
      setProductsError(null);

      try {
        const res = await fetch("/api/products", { method: "GET" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Failed to load products");
        }

        const list: Product[] = Array.isArray(data.products) ? data.products : [];

        const normalised: Product[] = list.map((p: any) => ({
          id: String(p.id),
          name: String(p.name ?? ""),
          description: String(p.description ?? ""),
          pricePence:
            typeof p.pricePence === "number"
              ? p.pricePence
              : Math.round(Number(p.price ?? 0) * 100),
          imageUrl: p.imageUrl ?? null,
          imageAlt: p.imageAlt ?? p.name ?? null,
        }));

        if (!cancelled) {
          setProducts(normalised);

          // Initialise qty for loaded products (preserve any existing qty)
          setQty((prev) => {
            const next: Record<string, number> = { ...prev };
            for (const pr of normalised) {
              if (next[pr.id] == null) next[pr.id] = 0;
            }
            // Remove qty entries for products that no longer exist
            for (const key of Object.keys(next)) {
              if (!normalised.some((p) => p.id === key)) delete next[key];
            }
            return next;
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setProductsError(e?.message ?? "Failed to load products");
          setProducts([]);
          setQty({});
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    return products.flatMap((p) => {
      const q = qty[p.id] ?? 0;
      if (q <= 0) return [];
      return [
        {
          productId: p.id,
          name: p.name,
          pricePence: p.pricePence,
          quantity: q,
        },
      ];
    });
  }, [products, qty]);

  const subtotalPence = useMemo(
    () => items.reduce((sum, i) => sum + i.pricePence * i.quantity, 0),
    [items]
  );

  const canSubmit =
    items.length > 0 &&
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    postcode.trim().length > 0 &&
    !submitting &&
    !loadingProducts &&
    !productsError;

  async function placeOrder() {
    setError(null);

    if (items.length === 0) return setError("Please select at least one product.");
    if (!customerName.trim()) return setError("Please enter your name.");
    if (!customerPhone.trim()) return setError("Please enter your phone number.");
    if (!postcode.trim()) return setError("Please enter your postcode.");
    if (submitting || loadingProducts || productsError) return;

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          postcode: normalisePostcode(postcode),
          preferredDay: preferredDay || undefined,
          deliveryNotes: deliveryNotes.trim() || undefined,
          items,
          checkoutPaymentMethod: paymentMethod,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Order failed. Please try again.");
        return;
      }

      // If Mollie selected, start payment immediately
      if (paymentMethod === "MOLLIE") {
        const r2 = await fetch("/api/pay/mollie/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId }),
        });

        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok && j2?.url) {
          window.location.href = j2.url;
          return;
        }

        // fallback: send them to thanks page with ability to click Pay Now / Resume
        router.push(`/thanks?orderId=${encodeURIComponent(data.orderId)}`);
        return;
      }

      router.push(`/thanks?orderId=${encodeURIComponent(data.orderId)}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--vf-bg)] text-[var(--vf-text)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-[var(--vf-bg)]/70 backdrop-blur">
        <div className="relative">
          <div
            className="relative h-[105px] w-full overflow-hidden bg-cover bg-center sm:h-[125px] md:h-[150px] lg:h-[175px]"
            style={{ backgroundImage: "url('/log-wall.jpg')" }}
          >
            <div className="absolute inset-0 bg-black/35" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(22,16,10,0.55) 0%, rgba(22,16,10,0.12) 60%, rgba(22,16,10,0.45) 100%)",
              }}
            />
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />

            <div className="absolute inset-0">
              <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-4 px-6">
                <Link
                  href="/"
                  className="flex items-center gap-4 rounded-3xl px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4"
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    className="rounded-2xl p-2 shadow-sm"
                    style={{
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <Image
                      src="/logo.png"
                      alt="Verrington Firewood"
                      width={70}
                      height={70}
                      priority
                    />
                  </div>

                  <div className="leading-tight">
                    <div className="text-2xl font-extrabold tracking-tight text-white drop-shadow sm:text-3xl md:text-4xl">
                      Order Firewood
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white/90 drop-shadow sm:text-base md:text-lg">
                      South Somerset &amp; North Dorset
                    </div>
                  </div>
                </Link>

                <nav
                  className="hidden items-center gap-2 rounded-3xl px-2 py-2 backdrop-blur-md sm:flex"
                  style={{
                    background: "rgba(0,0,0,0.28)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 14px 35px rgba(0,0,0,0.25)",
                  }}
                  aria-label="Order navigation"
                >
                  <Link
                    href="/prices"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold text-white/95 hover:bg-white/10"
                  >
                    Prices
                  </Link>
                  <Link
                    href="/delivery"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold text-white/95 hover:bg-white/10"
                  >
                    Delivery areas
                  </Link>
                  <Link
                    href="/"
                    className="rounded-2xl px-4 py-2 text-sm font-semibold text-white/95 hover:bg-white/10"
                  >
                    Home
                  </Link>
                </nav>

                <div className="absolute right-4 top-3 sm:hidden">
                  <div
                    className="flex items-center gap-2 rounded-2xl px-2 py-1 backdrop-blur-md"
                    style={{
                      background: "rgba(0,0,0,0.28)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <Link
                      href="/prices"
                      className="rounded-xl px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10"
                    >
                      Prices
                    </Link>
                    <Link
                      href="/delivery"
                      className="rounded-xl px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10"
                    >
                      Delivery
                    </Link>
                    <Link
                      href="/"
                      className="rounded-xl px-2 py-1 text-xs font-semibold text-white/95 hover:bg-white/10"
                    >
                      Home
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-white/10" />
        </div>
      </header>

      {/* Page content */}
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <section className="space-y-6">
          {/* Intro */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h1 className="text-2xl font-extrabold">Place your order</h1>
            <p className="mt-1 text-sm text-[var(--vf-muted)]">
              Choose your logs, add your details, and we’ll confirm delivery by text.
            </p>

            {productsError && (
              <div className="mt-4 rounded-2xl border p-4 text-sm text-red-700">
                Products couldn’t load: {productsError}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border p-4 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Products */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Products</h2>
                <p className="mt-1 text-sm text-[var(--vf-muted)]">
                  Tap + / – to choose quantities.
                </p>
              </div>
              <Link
                href="/prices"
                className="text-sm font-semibold underline underline-offset-4"
              >
                View prices
              </Link>
            </div>

            {loadingProducts ? (
              <div className="mt-4 space-y-4">
                <div className="h-24 rounded-3xl border bg-black/[0.03]" />
                <div className="h-24 rounded-3xl border bg-black/[0.03]" />
                <div className="h-24 rounded-3xl border bg-black/[0.03]" />
              </div>
            ) : products.length === 0 ? (
              <div className="mt-4 rounded-3xl border p-4 text-sm text-[var(--vf-muted)]">
                No products available right now.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {products.map((p) => {
                  const q = qty[p.id] ?? 0;
                  return (
                    <div key={p.id} className="rounded-3xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl border bg-black/[0.03] sm:h-20 sm:w-28">
                            <Image
                              src={p.imageUrl || "/products/placeholder.jpg"}
                              alt={p.imageAlt ?? p.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 80px, 112px"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold">{p.name}</div>
                            {p.description ? (
                              <div className="mt-1 text-sm text-[var(--vf-muted)]">
                                {p.description}
                              </div>
                            ) : null}
                            <div className="mt-2 font-semibold">
                              {formatGBPFromPence(p.pricePence)}
                            </div>

                            {q > 0 ? (
                              <div className="mt-1 text-sm text-[var(--vf-muted)]">
                                Line total:{" "}
                                <span className="font-semibold text-[var(--vf-text)]">
                                  {formatGBPFromPence(p.pricePence * q)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border text-lg font-bold hover:bg-black/5 disabled:opacity-40"
                            disabled={q === 0 || submitting}
                            onClick={() => dec(p.id)}
                            aria-label={`Decrease ${p.name}`}
                          >
                            –
                          </button>

                          <div className="w-8 text-center font-bold">{q}</div>

                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border text-lg font-bold hover:bg-black/5 disabled:opacity-40"
                            disabled={submitting}
                            onClick={() => inc(p.id)}
                            aria-label={`Increase ${p.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Basket */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h2 className="text-lg font-extrabold">Basket</h2>
            <p className="mt-1 text-sm text-[var(--vf-muted)]">
              Double-check your order before submitting.
            </p>

            {items.length === 0 ? (
              <div className="mt-4 rounded-3xl border p-4 text-sm text-[var(--vf-muted)]">
                No items selected yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {items.map((i) => {
                  const p = products.find((x) => x.id === i.productId);
                  return (
                    <div key={i.productId} className="rounded-3xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-2xl border bg-black/[0.03]">
                            <Image
                              src={p?.imageUrl || "/products/placeholder.jpg"}
                              alt={p?.imageAlt ?? i.name}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold">{i.name}</div>
                            <div className="mt-1 text-sm text-[var(--vf-muted)]">
                              {formatGBPFromPence(i.pricePence)} each
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold">
                            {formatGBPFromPence(i.pricePence * i.quantity)}
                          </div>

                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="h-9 w-9 rounded-xl border text-lg font-bold hover:bg-black/5 disabled:opacity-40"
                              disabled={i.quantity <= 1 || submitting}
                              onClick={() => dec(i.productId)}
                              aria-label={`Decrease ${i.name}`}
                            >
                              –
                            </button>

                            <input
                              value={String(i.quantity)}
                              inputMode="numeric"
                              className="h-9 w-14 rounded-xl border bg-transparent px-2 text-center font-bold outline-none focus:ring-2"
                              onChange={(e) => {
                                const n = parseInt(
                                  e.target.value.replace(/[^\d]/g, ""),
                                  10
                                );
                                setProductQty(i.productId, Number.isFinite(n) ? n : 0);
                              }}
                              disabled={submitting}
                              aria-label={`Quantity for ${i.name}`}
                            />

                            <button
                              type="button"
                              className="h-9 w-9 rounded-xl border text-lg font-bold hover:bg-black/5 disabled:opacity-40"
                              disabled={submitting}
                              onClick={() => inc(i.productId)}
                              aria-label={`Increase ${i.name}`}
                            >
                              +
                            </button>

                            <button
                              type="button"
                              className="ml-2 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-black/5 disabled:opacity-40"
                              onClick={() => remove(i.productId)}
                              disabled={submitting}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-3xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-[var(--vf-muted)]">Subtotal</div>
                    <div className="text-lg font-extrabold">
                      {formatGBPFromPence(subtotalPence)}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-[var(--vf-muted)]">
                    Delivery fee (if any) and final totals are confirmed after submission
                    based on your postcode.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h2 className="text-lg font-extrabold">Your details</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold">Postcode</label>
                <input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  onBlur={() => setPostcode((p) => normalisePostcode(p))}
                  placeholder="BA9 9AA"
                  autoComplete="postal-code"
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
                {postcode.trim().length > 0 && (
                  <div className="mt-2 text-sm text-[var(--vf-muted)]">
                    {looksLikeInArea(postcode)
                      ? "✅ Looks like we deliver here."
                      : "⚠️ Possibly outside our usual area — we’ll confirm."}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold">Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="name"
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Phone</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Email (optional)</label>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold">
                  Preferred delivery day (optional)
                </label>
                <input
                  type="date"
                  value={preferredDay}
                  onChange={(e) => setPreferredDay(e.target.value)}
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
                <p className="mt-2 text-xs text-[var(--vf-muted)]">
                  We’ll do our best, but we’ll confirm by text.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-semibold">Delivery notes (optional)</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please tip by the garage. Call on arrival. Narrow lane — small vehicle preferred."
                  className="mt-1 w-full rounded-2xl border bg-transparent px-4 py-3 outline-none focus:ring-2"
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h2 className="text-lg font-extrabold">Payment method</h2>
            <p className="mt-1 text-sm text-[var(--vf-muted)]">
              Choose how you’d like to pay. Bank transfer and cash are manual (no fees).
              Card/Apple Pay uses Mollie.
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border p-4 hover:bg-black/5">
                <input
                  type="radio"
                  name="paymentMethod"
                  className="mt-1"
                  checked={paymentMethod === "MOLLIE"}
                  onChange={() => setPaymentMethod("MOLLIE")}
                  disabled={submitting}
                />
                <div>
                  <div className="font-bold">Pay now (Card / Apple Pay)</div>
                  <div className="mt-1 text-sm text-[var(--vf-muted)]">
                    Secure checkout via Mollie.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border p-4 hover:bg-black/5">
                <input
                  type="radio"
                  name="paymentMethod"
                  className="mt-1"
                  checked={paymentMethod === "BACS"}
                  onChange={() => setPaymentMethod("BACS")}
                  disabled={submitting}
                />
                <div>
                  <div className="font-bold">Bank transfer (BACS)</div>
                  <div className="mt-1 text-sm text-[var(--vf-muted)]">
                    We’ll show bank details after you place the order.
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-3xl border p-4 hover:bg-black/5">
                <input
                  type="radio"
                  name="paymentMethod"
                  className="mt-1"
                  checked={paymentMethod === "CASH"}
                  onChange={() => setPaymentMethod("CASH")}
                  disabled={submitting}
                />
                <div>
                  <div className="font-bold">Pay on delivery (Cash)</div>
                  <div className="mt-1 text-sm text-[var(--vf-muted)]">
                    Pay when your logs arrive.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* What happens next */}
          <div
            className="rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h2 className="text-lg font-extrabold">What happens next?</h2>

            <div className="mt-3 space-y-2 text-sm text-[var(--vf-muted)]">
              <div className="flex gap-2">
                <span aria-hidden>①</span>
                <span>You place your order.</span>
              </div>
              <div className="flex gap-2">
                <span aria-hidden>②</span>
                <span>We confirm delivery day &amp; any delivery charge by text.</span>
              </div>
              <div className="flex gap-2">
                <span aria-hidden>③</span>
                <span>
                  Pay by your chosen method (Card/Apple Pay, bank transfer, or cash
                  on delivery).
                </span>
              </div>
            </div>
          </div>

          {/* Desktop submit */}
          <div className="hidden lg:block">
            <button
              onClick={placeOrder}
              disabled={!canSubmit}
              className="w-full rounded-2xl px-6 py-4 text-sm font-semibold disabled:opacity-50"
              style={{
                background: "var(--vf-primary)",
                color: "var(--vf-primary-contrast)",
              }}
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>

            <p className="mt-2 text-xs text-[var(--vf-muted)]">
              Delivery fee (if any) and totals are confirmed after submission based on
              your postcode.
            </p>
          </div>
        </section>

        {/* Right column summary */}
        <aside className="hidden lg:block">
          <div
            className="sticky top-28 rounded-3xl border p-6 shadow-sm"
            style={{ background: "var(--vf-surface)" }}
          >
            <h2 className="text-lg font-extrabold">Order summary</h2>

            <div className="mt-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-sm text-[var(--vf-muted)]">
                  No items selected yet.
                </div>
              ) : (
                items.map((i) => (
                  <div
                    key={i.productId}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="text-[var(--vf-muted)]">
                        {i.quantity} × {i.name}
                      </div>
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold underline underline-offset-4 hover:opacity-80"
                        onClick={() => remove(i.productId)}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="font-semibold">
                      {formatGBPFromPence(i.pricePence * i.quantity)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--vf-muted)]">Subtotal</span>
                <span className="text-lg font-extrabold">
                  {formatGBPFromPence(subtotalPence)}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--vf-muted)]">
                Delivery is confirmed after ordering.
              </p>
            </div>

            <div className="mt-4">
              <button
                onClick={placeOrder}
                disabled={!canSubmit}
                className="w-full rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--vf-primary)",
                  color: "var(--vf-primary-contrast)",
                }}
              >
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom bar with mini basket */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-[var(--vf-bg)]/95 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="text-left"
              onClick={() => setShowMobileSummary((s) => !s)}
              aria-expanded={showMobileSummary}
            >
              <div className="text-xs text-[var(--vf-muted)]">
                Subtotal{" "}
                {items.length
                  ? `• ${items.length} item${items.length === 1 ? "" : "s"}`
                  : ""}
              </div>
              <div className="text-base font-extrabold">
                {formatGBPFromPence(subtotalPence)}
              </div>
              <div className="mt-1 text-xs text-[var(--vf-muted)]">
                Tap to {showMobileSummary ? "hide" : "view"} basket
              </div>
            </button>

            <button
              onClick={placeOrder}
              disabled={!canSubmit}
              className="rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
              style={{
                background: "var(--vf-primary)",
                color: "var(--vf-primary-contrast)",
              }}
            >
              {submitting ? "Placing…" : "Place order"}
            </button>
          </div>

          {showMobileSummary && (
            <div
              className="mt-3 rounded-2xl border p-3"
              style={{ background: "var(--vf-surface)" }}
            >
              {items.length === 0 ? (
                <div className="text-sm text-[var(--vf-muted)]">
                  No items selected yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((i) => (
                    <div
                      key={i.productId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[var(--vf-muted)]">
                          {i.quantity} × {i.name}
                        </div>
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold underline underline-offset-4"
                          onClick={() => remove(i.productId)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="font-semibold">
                        {formatGBPFromPence(i.pricePence * i.quantity)}
                      </div>
                    </div>
                  ))}

                  <div className="mt-3 flex justify-between border-t pt-3 text-sm">
                    <span className="text-[var(--vf-muted)]">Subtotal</span>
                    <span className="text-base font-extrabold">
                      {formatGBPFromPence(subtotalPence)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[var(--vf-muted)]">
                    Delivery fee (if any) and totals are confirmed after submission.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-24 lg:hidden" />
    </main>
  );
}
