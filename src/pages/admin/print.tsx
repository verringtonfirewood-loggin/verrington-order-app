import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { adminFetch, loadAdminCreds, saveAdminCreds } from "@/lib/adminClientAuth";

type AdminOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  pricePence: number;
};

type AdminOrder = {
  id: string;
  createdAt: string;
  status: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;
  postcode: string;

  totalPence: number;
  subtotalPence?: number;
  deliveryFeePence?: number;

  orderNumber: string | null;

  paymentMethod: string;
  paymentStatus: string;
  paidAt: string | null;

  items: AdminOrderItem[];
};

function formatGBPFromPence(pence: number): string {
  return `£${(Number(pence || 0) / 100).toFixed(2)}`;
}

function safeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normStatus(s: string) {
  return String(s || "").trim().toUpperCase().replace(/_/g, "-");
}

function paymentLabel(method: string) {
  const m = String(method || "").toUpperCase();
  if (m === "MOLLIE") return "CARD";
  return m || "—";
}

function paymentColours(method: string, status: string) {
  const m = String(method || "").toUpperCase();
  const s = String(status || "").toUpperCase();

  // ✅ Paid = green (quick win)
  if (s === "PAID") return { bg: "#e8f7ee", fg: "#1f7a4c", border: "#b7ebce" };

  // ✅ Pending = amber
  if (s === "PENDING") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };

  // ✅ Failed/cancelled/etc = red-ish
  if (s === "FAILED") return { bg: "#fdecec", fg: "#b42318", border: "#f5c2c0" };
  if (s === "EXPIRED") return { bg: "#fff0e5", fg: "#9a3412", border: "#fed7aa" };
  if (s === "CANCELED") return { bg: "#f4f4f5", fg: "#3f3f46", border: "#e4e4e7" };

  // ✅ Unpaid gets method-specific colour
  if (s === "UNPAID") {
    if (m === "BACS") return { bg: "#e8f3ff", fg: "#1e40af", border: "#bfdbfe" }; // blue
    if (m === "CASH") return { bg: "#f3f4f6", fg: "#111827", border: "#d1d5db" }; // neutral/grey
    if (m === "MOLLIE") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" }; // amber
  }

  // Default neutral
  return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb" };
}

function PaymentPill({ method, status }: { method: string; status: string }) {
  const c = paymentColours(method, status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {paymentLabel(method)} • {String(status || "").toUpperCase() || "—"}
    </span>
  );
}

const PrintPage: NextPage = () => {
  const router = useRouter();

  const ids = useMemo(() => {
    const raw = router.query.ids;
    const s =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
        ? raw[0]
        : "";
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }, [router.query.ids]);

  const [username, setUsername] = useState("mike");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    const stored = loadAdminCreds();
    if (stored) {
      setUsername(stored.username);
      setPassword(stored.password);
      if (ids.length) void load(stored.username, stored.password, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length]);

  async function load(u = username, p = password, opts?: { silent?: boolean }) {
    setError(null);

    if (!ids.length) {
      setOrders([]);
      setError("No order ids provided in the URL (expected ?ids=id1,id2,...)");
      return;
    }

    if (!u || !p) {
      setError("Enter username and password, then click Load.");
      return;
    }

    saveAdminCreds({ username: u, password: p });

    setLoading(true);
    if (!opts?.silent) setError(null);

    try {
      const qs = encodeURIComponent(ids.join(","));
      const data = await adminFetch<{ ok: true; orders: AdminOrder[] }>(`/api/admin/orders?ids=${qs}`, {
        method: "GET",
        username: u,
        password: p,
      });

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e: any) {
      setOrders([]);
      setError(e?.message ? String(e.message) : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function printNow() {
    window.print();
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/admin/dispatch">← Back to Dispatch</Link>
          <Link href="/admin/orders">Orders</Link>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 160 }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 160 }}
          />
          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading…" : "Load"}
          </button>
          <button
            onClick={printNow}
            disabled={!orders.length}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: orders.length ? "#fff" : "#f5f5f5",
              cursor: orders.length ? "pointer" : "not-allowed",
            }}
          >
            Print
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print" style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #f0c", background: "#fff5fb" }}>
          <strong>Print load error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {orders.map((o) => {
          const itemsSumPence = (o.items || []).reduce(
            (sum, it) => sum + Number(it.pricePence || 0) * Number(it.quantity || 0),
            0
          );

          return (
            <div key={o.id} className="sheet">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Verrington Firewood — Delivery Docket</div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                    {o.orderNumber ? `Order: ${o.orderNumber}` : `Order ID: ${o.id}`}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>
                    Created: {safeDate(o.createdAt)} • Status: {normStatus(o.status)}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <PaymentPill method={o.paymentMethod} status={o.paymentStatus} />
                    {o.paidAt ? <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.75 }}>Paid: {safeDate(o.paidAt)}</span> : null}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Total</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{formatGBPFromPence(o.totalPence || 0)}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                <div style={{ border: "1px solid #eaeaea", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Customer</div>
                  <div style={{ fontWeight: 800 }}>{o.customerName || "-"}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{o.customerEmail || "-"}</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{o.customerPhone || "-"}</div>
                </div>

                <div style={{ border: "1px solid #eaeaea", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Delivery postcode</div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{o.postcode || "-"}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Items</div>

                <div style={{ border: "1px solid #eaeaea", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th style={{ textAlign: "left", padding: 10, fontSize: 12, opacity: 0.8 }}>Item</th>
                        <th style={{ textAlign: "right", padding: 10, fontSize: 12, opacity: 0.8 }}>Qty</th>
                        <th style={{ textAlign: "right", padding: 10, fontSize: 12, opacity: 0.8 }}>Unit</th>
                        <th style={{ textAlign: "right", padding: 10, fontSize: 12, opacity: 0.8 }}>Line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(o.items || []).map((it) => {
                        const line = Number(it.pricePence || 0) * Number(it.quantity || 0);
                        return (
                          <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                            <td style={{ padding: 10 }}>{it.name || "-"}</td>
                            <td style={{ padding: 10, textAlign: "right" }}>{it.quantity ?? 0}</td>
                            <td style={{ padding: 10, textAlign: "right" }}>{formatGBPFromPence(it.pricePence || 0)}</td>
                            <td style={{ padding: 10, textAlign: "right" }}>{formatGBPFromPence(line)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <div style={{ minWidth: 320 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                      <span style={{ opacity: 0.8 }}>Items sum</span>
                      <strong>{formatGBPFromPence(itemsSumPence)}</strong>
                    </div>

                    {typeof o.subtotalPence === "number" && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginTop: 4 }}>
                        <span style={{ opacity: 0.8 }}>Subtotal</span>
                        <strong>{formatGBPFromPence(o.subtotalPence)}</strong>
                      </div>
                    )}

                    {typeof o.deliveryFeePence === "number" && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginTop: 4 }}>
                        <span style={{ opacity: 0.8 }}>Delivery</span>
                        <strong>{formatGBPFromPence(o.deliveryFeePence)}</strong>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15, marginTop: 8 }}>
                      <span>Total</span>
                      <strong>{formatGBPFromPence(o.totalPence || 0)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.85 }}>
                Delivered by: ______________________ &nbsp;&nbsp; Signature: ______________________ &nbsp;&nbsp; Date: __________
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        .sheet {
          border: 1px solid #ddd;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 18px;
          break-inside: avoid;
          background: #fff;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          .sheet {
            border: none;
            border-radius: 0;
            margin: 0;
            padding: 0;
            page-break-after: always;
          }
          .sheet:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintPage;
