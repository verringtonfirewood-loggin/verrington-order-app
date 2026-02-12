import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OrderItem = {
  id: string;
  productId: string;
  name?: string | null;
  quantity: number;
  pricePence: number;
};

type Order = {
  id: string;
  createdAt: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  postcode: string;
  subtotalPence?: number | null;
  totalPence?: number | null;
  deliveryFeePence?: number | null;
  items?: OrderItem[];
};

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(gbp);
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const STATUSES = ["", "NEW", "PAID", "DISPATCHED", "DELIVERED", "CANCELLED"] as const;

const AdminOrdersPage: NextPage = () => {
  // Basic auth credentials (used to call /api/admin/orders)
  const [user, setUser] = useState("mike");
  const [pass, setPass] = useState("");

  // Filters
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [take, setTake] = useState<number>(50);

  // Data
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const authHeader = useMemo(() => {
    const pair = `${user}:${pass}`;
    const b64 = typeof window !== "undefined" ? window.btoa(pair) : "";
    return `Basic ${b64}`;
  }, [user, pass]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    if (take) params.set("take", String(take));
    const s = params.toString();
    return `/api/admin/orders${s ? `?${s}` : ""}`;
  }, [status, q, take]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `Failed to load orders (HTTP ${res.status})`);
      }

      const list: Order[] = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list);
    } catch (e: any) {
      setOrders([]);
      setErr(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load once password is provided, and whenever filters change
  useEffect(() => {
    if (!pass) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, authHeader]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return counts;
  }, [orders]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <header style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin • Orders</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{ textDecoration: "none", opacity: 0.85 }}>
            ← Home
          </Link>

          <button
            type="button"
            onClick={load}
            disabled={!pass || loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: !pass || loading ? "#999" : "#111",
              color: "white",
              cursor: !pass || loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* Auth */}
      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Basic Auth</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Username</div>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Password</div>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              type="password"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              placeholder="Enter admin password to load"
            />
          </label>

          <div style={{ gridColumn: "1 / -1", fontSize: 12, opacity: 0.7 }}>
            Calls <code>/api/admin/orders</code> with Basic Auth. Password is not stored.
          </div>
        </div>
      </section>

      {/* Filters */}
      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Filters</div>

        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUSES.map((s) => {
              const active = status === s;
              const label = s === "" ? "ALL" : s;
              const count = s === "" ? orders.length : (statusCounts[s] ?? 0);

              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: active ? "#111" : "white",
                    color: active ? "white" : "#111",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {label} <span style={{ opacity: active ? 0.9 : 0.6, fontWeight: 700 }}>({count})</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Search</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="postcode, name, phone, email, order id"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Limit</div>
              <select
                value={take}
                onChange={(e) => setTake(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setQ("");
                setTake(50);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Clear
            </button>

            <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
              API: <code>{url}</code>
            </div>
          </div>
        </div>
      </section>

      {err ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f3c2c2", borderRadius: 12, background: "#fff5f5" }}>
          <div style={{ fontWeight: 800, color: "crimson" }}>Fix needed</div>
          <div style={{ marginTop: 6 }}>{err}</div>
        </div>
      ) : null}

      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Orders ({orders.length})</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 12 }}>Created</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Customer</th>
                <th style={{ padding: 12 }}>Postcode</th>
                <th style={{ padding: 12 }}>Items</th>
                <th style={{ padding: 12, textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatDateTime(o.createdAt)}</td>
                  <td style={{ padding: 12, fontWeight: 800 }}>{o.status}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800 }}>{o.customerName}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{o.customerPhone}</div>
                    {o.customerEmail ? <div style={{ fontSize: 12, opacity: 0.8 }}>{o.customerEmail}</div> : null}
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {o.id}
                    </div>
                  </td>
                  <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 700 }}>{o.postcode}</td>
                  <td style={{ padding: 12 }}>
                    {Array.isArray(o.items) && o.items.length ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {o.items.slice(0, 5).map((it) => (
                          <li key={it.id} style={{ fontSize: 12, opacity: 0.9 }}>
                            {it.quantity} × {it.name ?? it.productId}
                          </li>
                        ))}
                        {o.items.length > 5 ? <li style={{ fontSize: 12, opacity: 0.7 }}>+{o.items.length - 5} more…</li> : null}
                      </ul>
                    ) : (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: "right", fontWeight: 800 }}>
                    {typeof o.subtotalPence === "number" ? formatGBPFromPence(o.subtotalPence) : "—"}
                  </td>
                </tr>
              ))}

              {!loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, fontSize: 13, opacity: 0.7 }}>
                    No orders match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default AdminOrdersPage;
