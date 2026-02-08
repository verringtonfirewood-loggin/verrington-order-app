import { useEffect, useMemo, useState } from "react";

type OrderItem = {
  id: string;
  productId: string;
  name: string;
  pricePence: number;
  quantity: number;
};

type Order = {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  postcode: string;
  totalPence: number;
  status: string;
  items: OrderItem[];
};

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "out-for-delivery"]);

function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function outcode(postcode: string) {
  const p = (postcode ?? "").trim().toUpperCase();
  if (!p) return "(missing)";
  const parts = p.split(/\s+/);
  return parts[0] || p;
}

export default function DispatchRouteViewPage() {
  const [take, setTake] = useState(100);
  const [includeDelivered, setIncludeDelivered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders?take=${take}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Failed to load");
      setOrders(json.orders ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take]);

  const filtered = useMemo(() => {
    const list = orders.slice();
    if (includeDelivered) return list;
    return list.filter((o) => ACTIVE_STATUSES.has(o.status));
  }, [orders, includeDelivered]);

  const groups = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of filtered) {
      const key = outcode(o.postcode);
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    // Sort groups by total descending
    const arr = Array.from(map.entries()).map(([key, os]) => ({
      key,
      orders: os.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      totalPence: os.reduce((s, o) => s + (o.totalPence ?? 0), 0),
      count: os.length,
    }));
    arr.sort((a, b) => b.totalPence - a.totalPence);
    return arr;
  }, [filtered]);

  const totals = useMemo(() => {
    const count = filtered.length;
    const sum = filtered.reduce((s, o) => s + (o.totalPence ?? 0), 0);
    return { count, sum };
  }, [filtered]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ marginBottom: 8 }}>Verrington Firewood — Route View</h1>
        <a href="/admin/orders" style={{ fontSize: 14 }}>
          ← Back to orders
        </a>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14 }}>Look back</label>
          <select value={take} onChange={(e) => setTake(Number(e.target.value))} style={{ padding: 10, width: 160 }}>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={200}>Last 200</option>
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
          <input type="checkbox" checked={includeDelivered} onChange={(e) => setIncludeDelivered(e.target.checked)} />
          Include delivered/cancelled
        </label>

        <button onClick={() => void load()} style={{ padding: "10px 12px" }} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Orders shown: {totals.count}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Total: {formatGBP(totals.sum)}</div>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", marginBottom: 16 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((g) => (
          <section key={g.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{g.key}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Orders: {g.count} • Group total: {formatGBP(g.totalPence)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {g.orders.map((o) => (
                <div key={o.id} style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {o.customerName}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>({o.status})</span>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        {o.customerPhone}
                        {o.customerEmail ? ` • ${o.customerEmail}` : ""}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.8 }}>
                        {o.postcode} • {new Date(o.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{formatGBP(o.totalPence)}</div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <b>Items:</b>{" "}
                    {o.items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {!loading && groups.length === 0 ? (
          <div style={{ padding: 16, border: "1px dashed #ccc", borderRadius: 8, opacity: 0.8 }}>
            No orders match the current filters.
          </div>
        ) : null}
      </div>
    </main>
  );
}
