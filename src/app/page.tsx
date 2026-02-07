"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // GBP
  checkoutUrl: string;
};

const PRODUCTS: Product[] = [
  {
    id: "net",
    name: "Net of Logs",
    description: "Perfect for occasional fires. Easy to store and handle.",
    price: 20,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14196058/large-20kg-net-of-logs",
  },
  {
    id: "bulk-bag",
    name: "Bulk Bag of Logs",
    description: "Best value for regular burners. Seasoned hardwood.",
    price: 100,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14196007/back-in-stock-premium-dumpy-bag-of-fully-seasoned-firewood",
  },
  {
    id: "ibc-crate",
    name: "IBC Crate",
    description:
      "A full IBC Crate worth of loose-tipped, fully seasoned, beautifully dry logs, cut to practical lengths.",
    price: 195,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14188502/back-in-stock-ibc-crate-approx-1-2-cube-of-logs",
  },
];

export default function Home() {
  const [productId, setProductId] = useState(PRODUCTS[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [postcode, setPostcode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = useMemo(
    () => PRODUCTS.find((p) => p.id === productId) ?? PRODUCTS[0],
    [productId]
  );

  const total = (selected?.price ?? 0) * quantity;

  async function submitOrder() {
    setMessage(null);

    if (!selected) {
      setMessage("Select a product.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !postcode.trim()) {
      setMessage("Please fill in name, phone, and postcode.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail: customerEmail.trim() || undefined,
          postcode,
          items: [
            {
              productId: selected.id,
              name: selected.name,
              price: selected.price,
              quantity,
            },
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error ?? "Order failed.");
        return;
      }

      setMessage(`Order received ✅ (ID: ${data.orderId})`);
      // leave fields as-is for now (useful during testing)
    } catch {
      setMessage("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Verrington Firewood"
            width={180}
            height={60}
            priority
          />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--vf-text)" }}>
              Verrington Order App
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--vf-muted)" }}>
              Online ordering for seasoned firewood
            </p>
          </div>
        </div>

        {/* Products */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Products</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {PRODUCTS.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border p-6 flex flex-col justify-between"
                style={{ background: "var(--vf-surface)" }}
              >
                <div>
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
                    {product.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xl font-bold">£{product.price}</span>

                  <a
                    href={product.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--vf-primary)",
                      color: "var(--vf-primary-contrast)",
                    }}
                  >
                    Order on Webador
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm" style={{ color: "var(--vf-muted)" }}>
            Clicking “Order on Webador” opens secure checkout in a new tab.
          </p>
        </section>

        {/* Internal order capture (for admin pipeline) */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Send order to Admin (internal)</h2>

          <div className="rounded-2xl border p-6" style={{ background: "var(--vf-surface)" }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Product
                </span>
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (£{p.price})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Quantity
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Customer name
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Mike Hilton"
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Phone
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07..."
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Email (optional)
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@email.com"
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1" style={{ color: "var(--vf-muted)" }}>
                  Postcode
                </span>
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="TA..."
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-lg font-bold">Total: £{total}</div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{
                  background: "var(--vf-primary)",
                  color: "var(--vf-primary-contrast)",
                }}
              >
                {submitting ? "Submitting..." : "Submit to Admin"}
              </button>
            </div>

            {message ? (
              <p className="mt-4 text-sm" style={{ color: "var(--vf-muted)" }}>
                {message}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
