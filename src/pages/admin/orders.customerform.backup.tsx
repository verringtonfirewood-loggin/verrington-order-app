import type { NextPage } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  pricePence: number;
  description?: string;
};

const PRODUCTS: Product[] = [
  { id: "net", name: "Net of Logs", pricePence: 2000, description: "Ready to burn net of logs" },
  { id: "kindling", name: "Kindling", pricePence: 325, description: "Bag of kindling" },
  // Add more as you like (keep ids stable if you already use them elsewhere)
  // { id: "bag", name: "Dumpy Bag", pricePence: 12000 },
];

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function normalisePostcode(pc: string) {
  return pc.trim().toUpperCase().replace(/\s+/g, " ");
}

function isValidUkPostcode(pc: string) {
  // Light validation (not perfect, but catches obvious junk)
  const s = normalisePostcode(pc);
  return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(s);
}

const OrderPage: NextPage = () => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");

  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(PRODUCTS.map((p) => [p.id, 0]))
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId?: string; message: string } | null>(null);

  const items = useMemo(() => {
    return PRODUCTS.map((p) => ({
      productId: p.id,
      name: p.name,
      quantity: Math.max(0, Number(qty[p.id] ?? 0) || 0),
      pricePence: p.pricePence,
      linePence: (Math.max(0, Number(qty[p.id] ?? 0) || 0)) * p.pricePence,
    })).filter((i) => i.quantity > 0);
  }, [qty]);

  const totalPence = useMemo(() => items.reduce((s, i) => s + i.linePence, 0), [items]);

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (!phone.trim()) return false;
    if (!email.trim()) return false;
    if (!postcode.trim()) return false;
    if (!isValidUkPostcode(postcode)) return false;
    if (items.length === 0) return false;
    return true;
  }, [name, phone, email, postcode, items.length]);

  function setQuantity(productId: string, next: number) {
    setQty((q) => ({ ...q, [productId]: Math.max(0, Math.min(99, next)) }));
  }

  async function submit() {
    setError(null);
    setSuccess(null);

    // Client-side validation
    if (!canSubmit) {
      setError("Please complete your details, add at least one item, and enter a valid UK postcode.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim(),
        postcode: normalisePostcode(postcode),
     items: items.map((i) => ({
  productId: i.productId,
  name: i.name,
  pricePence: i.pricePence,
  quantity: i.quantity,
})),

      };

      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const txt = await r.text();
      let j: any = null;
      try {
        j = txt ? JSON.parse(txt) : null;
      } catch {
        j = txt;
      }

      if (!r.ok) {
        const msg =
          j?.error ||
          j?.message ||
          (typeof j === "string" ? j : null) ||
          `Order failed (HTTP ${r.status})`;
        setError(msg);
        return;
      }

      // Try common response shapes
      const orderId =
        j?.order?.id ||
        j?.id ||
        j?.orderId ||
        undefined;

      setSuccess({
        orderId,
        message: "Order received. We’ll be in touch to confirm delivery.",
      });

      // Reset form (keep details? your choice)
      setQty(Object.fromEntries(PRODUCTS.map((p) => [p.id, 0])));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Order Firewood</h1>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/" style={{ textDecoration: "none", opacity: 0.8 }}>
            ← Home
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.75 }}>
        Choose your items, enter your details, and submit your order.
      </div>

      {success && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #cfe9d6", borderRadius: 12, background: "#f3fbf6" }}>
          <div style={{ fontWeight: 800, color: "#1d7a35" }}>Success</div>
          <div style={{ marginTop: 6 }}>{success.message}</div>
          {success.orderId && (
            <div style={{ marginTop: 6, opacity: 0.8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
              Order ID: {success.orderId}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f3c2c2", borderRadius: 12, background: "#fff5f5" }}>
          <div style={{ fontWeight: 800, color: "crimson" }}>Fix needed</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Items */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Items</div>
          <div style={{ padding: 12 }}>
            {PRODUCTS.map((p) => (
              <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid #eee" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, opacity: 0.7 }}>{p.description}</div>}
                    <div style={{ marginTop: 4, opacity: 0.85 }}>{formatGBP(p.pricePence)}</div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setQuantity(p.id, (qty[p.id] ?? 0) - 1)}
                      style={btnSmall}
                    >
                      −
                    </button>
                    <input
                      value={qty[p.id] ?? 0}
                      onChange={(e) => setQuantity(p.id, Number(e.target.value))}
                      inputMode="numeric"
                      style={{
                        width: 56,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        textAlign: "center",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(p.id, (qty[p.id] ?? 0) + 1)}
                      style={btnSmall}
                    >
                      +
                    </button>
                  </div>
                </div>

                {(qty[p.id] ?? 0) > 0 && (
                  <div style={{ marginTop: 6, opacity: 0.8 }}>
                    Line: <b>{formatGBP((qty[p.id] ?? 0) * p.pricePence)}</b>
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "2px solid #111", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 800 }}>Total</div>
              <div style={{ fontWeight: 800 }}>{formatGBP(totalPence)}</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Your details</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            <Field label="Full name" value={name} setValue={setName} placeholder="e.g. Mike Hilton" />
            <Field label="Phone" value={phone} setValue={setPhone} placeholder="e.g. 07123 456789" />
            <Field label="Email" value={email} setValue={setEmail} placeholder="e.g. you@email.com" />
            <Field label="Postcode" value={postcode} setValue={setPostcode} placeholder="e.g. TA1 1AA" />

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              We’ll use your phone/email to confirm delivery timing.
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || submitting}
              style={{
                marginTop: 4,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: !canSubmit || submitting ? "#999" : "#111",
                color: "white",
                cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {submitting ? "Submitting…" : "Place order"}
            </button>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Admin will see it instantly in <code>/admin/orders</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Field({
  label,
  value,
  setValue,
  placeholder,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #ddd",
        }}
      />
    </label>
  );
}

const btnSmall: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: "34px",
};

export default OrderPage;
