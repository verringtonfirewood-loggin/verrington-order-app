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

function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function AdminOrdersPage() {
  const [take, setTake] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  async function load(currentTake = take) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders?take=${currentTake}`);
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
    // Load on first view
    void load(take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reload when "take" changes
    void load(take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take]);

  const totals = useMemo(() => {
    const count = orders.length;
    const sum = orders.reduce((s, o) => s + (o.totalPence ?? 0), 0);
    return { count, sum };
  }, [orders]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ marginBottom: 8 }}>Verrington Firewood — Orders Admin</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14 }}>Show last</label>
          <select value={take} onChange={(e) => setTake(Number(e.target.value))} style={{ padding: 10, width: 140 }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <button onClick={() => void load(take)} style={{ padding: "10px 12px" }} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Loaded orders: {totals.count}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Total: {formatGBP(totals.sum)}</div>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", marginBottom: 16 }}>
          <b>Error:</b> {error}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            If you see a 401, it means the browser hasn’t sent Basic Auth yet — reload and re-enter credentials.
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {orders.map((o) => (
          <div key={o.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{o.customerName}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {new Date(o.createdAt).toLocaleString()} • {o.postcode} • {o.status}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {o.customerPhone}
                  {o.customerEmail ? ` • ${o.customerEmail}` : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>Order ID: {o.id}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{formatGBP(o.totalPence)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 13, opacity: 0.8 }}>
                    <th style={{ padding: "6px 0" }}>Item</th>
                    <th style={{ padding: "6px 0" }}>Qty</th>
                    <th style={{ padding: "6px 0" }}>Unit</th>
                    <th style={{ padding: "6px 0" }}>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 0" }}>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.65 }}>{it.productId}</div>
                      </td>
                      <td style={{ padding: "8px 0" }}>{it.quantity}</td>
                      <td style={{ padding: "8px 0" }}>{formatGBP(it.pricePence)}</td>
                      <td style={{ padding: "8px 0" }}>{formatGBP(it.pricePence * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!loading && orders.length === 0 ? (
          <div style={{ padding: 16, border: "1px dashed #ccc", borderRadius: 8, opacity: 0.8 }}>
            No orders found.
          </div>
        ) : null}
      </div>
    </main>
  );
}
