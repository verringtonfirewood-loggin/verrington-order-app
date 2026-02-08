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

const STATUSES = ["pending", "confirmed", "out-for-delivery", "delivered", "cancelled"] as const;

function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export default function AdminOrdersPage() {
  const [take, setTake] = useState(50);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  async function load(currentTake = take, currentStatus = statusFilter, currentQ = q) {
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      qs.set("take", String(currentTake));
      if (currentStatus) qs.set("status", currentStatus);
      if (currentQ.trim()) qs.set("q", currentQ.trim());

      const res = await fetch(`/api/admin/orders?${qs.toString()}`);
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
    void load(take, statusFilter, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(take, statusFilter, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take, statusFilter]);

  const totals = useMemo(() => {
    const count = orders.length;
    const sum = orders.reduce((s, o) => s + (o.totalPence ?? 0), 0);
    const selected = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k);
    return { count, sum, selectedCount: selected.length, selectedIds: selected };
  }, [orders, selectedIds]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function clearSelection() {
    setSelectedIds({});
  }

  async function updateStatus(orderId: string, status: string) {
    setSavingId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Failed to update status");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: json.order.status } : o)));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  function printSelected() {
    if (totals.selectedCount === 0) return;
    const ids = totals.selectedIds.join(",");
    window.open(`/admin/print?ids=${encodeURIComponent(ids)}`, "_blank", "noopener,noreferrer");
  }

  function applySearch() {
    void load(take, statusFilter, q);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ marginBottom: 8 }}>Verrington Firewood — Orders Admin</h1>
        <a href="/admin/dispatch" style={{ fontSize: 14 }}>
          Route view →
        </a>
      </div>

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

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14 }}>Filter status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: 10, width: 190 }}>
            <option value="">(all)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 260px", minWidth: 240 }}>
          <label style={{ fontSize: 14 }}>Search</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Name, phone, email, postcode…"
              style={{ padding: 10, width: "100%" }}
            />
            <button onClick={applySearch} style={{ padding: "10px 12px" }} disabled={loading}>
              Go
            </button>
          </div>
        </div>

        <button onClick={() => void load(take, statusFilter, q)} style={{ padding: "10px 12px" }} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button onClick={printSelected} style={{ padding: "10px 12px" }} disabled={totals.selectedCount === 0}>
          Print selected ({totals.selectedCount})
        </button>

        <button onClick={clearSelection} style={{ padding: "10px 12px" }} disabled={totals.selectedCount === 0}>
          Clear selection
        </button>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Loaded orders: {totals.count}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Total: {formatGBP(totals.sum)}</div>
        </div>
      </div>

      {error ? (
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee", marginBottom: 16 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {orders.map((o) => (
          <div key={o.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <input type="checkbox" checked={!!selectedIds[o.id]} onChange={() => toggleSelect(o.id)} style={{ marginTop: 4 }} />
                <div>
                  <div style={{ fontWeight: 800 }}>{o.customerName}</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    {new Date(o.createdAt).toLocaleString()} • {o.postcode} •{" "}
                    <span style={{ fontWeight: 700 }}>{o.status}</span>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    {o.customerPhone}
                    {o.customerEmail ? ` • ${o.customerEmail}` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Order ID: {o.id}</div>
                </div>
              </div>

              <div style={{ textAlign: "right", minWidth: 240 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatGBP(o.totalPence)}</div>
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 12, opacity: 0.8, display: "block", marginBottom: 4 }}>Status</label>
                  <select
                    value={o.status}
                    onChange={(e) => void updateStatus(o.id, e.target.value)}
                    disabled={savingId === o.id}
                    style={{ padding: 8, width: "100%" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {savingId === o.id ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Saving…</div> : null}
                </div>
              </div>
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
            No orders match your filters/search.
          </div>
        ) : null}
      </div>
    </main>
  );
}
