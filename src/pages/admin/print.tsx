import { useMemo, useState } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";

type AdminOrderItem = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  pricePence: number;
};

type AdminOrder = {
  id: string;
  createdAt: string; // ISO string
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  postcode: string;
  totalPence: number;
  subtotalPence?: number;
  deliveryFeePence?: number;
  orderNumber: string | null;
  items: AdminOrderItem[];
};

function formatGBPFromPence(pence: number): string {
  const pounds = (Number(pence || 0) / 100).toFixed(2);
  return `£${pounds}`;
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

function basicAuthHeader(username: string, password: string): string {
  // btoa expects latin1; credentials here are simple, so fine.
  const token = typeof window !== "undefined" ? window.btoa(`${username}:${password}`) : "";
  return `Basic ${token}`;
}

const PrintPage: NextPage = () => {
  const router = useRouter();

  const ids = useMemo(() => {
    const raw = router.query.ids;
    const s =
      typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }, [router.query.ids]);

  const [username, setUsername] = useState("mike");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  async function load() {
    setError(null);

    if (!ids.length) {
      setOrders([]);
      setError("No order ids provided in the URL (expected ?ids=id1,id2,...)");
      return;
    }

    if (!username || !password) {
      setError("Enter username and password, then click Load.");
      return;
    }

    setLoading(true);
    try {
      const qs = encodeURIComponent(ids.join(","));
      const res = await fetch(`/api/admin/orders?ids=${qs}`, {
        method: "GET",
        headers: {
          Authorization: basicAuthHeader(username, password),
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error ? String(data.error) : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      if (!data || data.ok !== true || !Array.isArray(data.orders)) {
        throw new Error("Unexpected API response shape from /api/admin/orders");
      }

      setOrders(data.orders as AdminOrder[]);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/admin/dispatch">← Back to Dispatch</Link>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", width: 180 }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd", width: 180 }}
          />
          <button
            onClick={load}
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
              color: "#111",
              cursor: orders.length ? "pointer" : "not-allowed",
            }}
          >
            Print
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, border: "1px solid #f0c", background: "#fff5fb" }}>
          <strong>Print load error:</strong> {error}
        </div>
      )}

      {/* Helpful hint so it never looks “blank” */}
      {!error && !orders.length && (
        <div style={{ marginTop: 24, opacity: 0.8 }}>
          <div style={{ fontSize: 14 }}>
            Ready to print {ids.length ? `${ids.length} order(s)` : "orders"}.
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Click <strong>Load</strong> to fetch the orders.
          </div>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {orders.map((o, idx) => {
          const itemsSumPence = (o.items || []).reduce(
            (sum, it) => sum + Number(it.pricePence || 0) * Number(it.quantity || 0),
            0
          );

          return (
            <div
              key={o.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 18,
                marginBottom: 18,
                breakInside: "avoid",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    Delivery Docket {o.orderNumber ? `— ${o.orderNumber}` : ""}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: 0.75 }}>
                    Order ID: {o.id}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2, opacity: 0.75 }}>
                    Created: {safeDate(o.createdAt)} • Status: {String(o.status || "").toUpperCase()}
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 220 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Docket</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{idx + 1} / {orders.length}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Customer</div>
                  <div style={{ fontWeight: 700 }}>{o.customerName || "-"}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{o.customerEmail || "-"}</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{o.customerPhone || "-"}</div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Postcode</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{o.postcode || "-"}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Items</div>

                <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
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

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
                Notes / signature: ________________________________________________
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        @media print {
          a,
          button,
          input {
            display: none !important;
          }
          body {
            background: #fff !important;
          }
          div {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintPage;
