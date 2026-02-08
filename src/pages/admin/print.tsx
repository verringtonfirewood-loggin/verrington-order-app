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

function getIdsFromLocation(): string[] {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("ids") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PrintOrdersPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const ids = useMemo(() => (typeof window === "undefined" ? [] : getIdsFromLocation()), []);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (ids.length === 0) {
          setOrders([]);
          return;
        }
        const res = await fetch(`/api/admin/orders?ids=${encodeURIComponent(ids.join(","))}`);
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
    void run();
  }, [ids]);

  const total = useMemo(() => orders.reduce((s, o) => s + (o.totalPence ?? 0), 0), [orders]);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Print — Delivery Sheets</h1>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Orders: {orders.length} • Total: {formatGBP(total)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "10px 12px" }}>
            Print
          </button>
          <a href="/admin/orders" style={{ padding: "10px 12px", display: "inline-block" }}>
            Back to admin
          </a>
        </div>
      </div>

      {loading ? <div style={{ marginTop: 16 }}>Loading…</div> : null}
      {error ? (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f99", background: "#fee" }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {orders.map((o) => (
          <section key={o.id} style={{ border: "1px solid #000", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{o.customerName}</div>
                <div style={{ fontSize: 14 }}>
                  {o.customerPhone}
                  {o.customerEmail ? ` • ${o.customerEmail}` : ""}
                </div>
                <div style={{ fontSize: 14 }}>
                  <b>Postcode:</b> {o.postcode}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {new Date(o.createdAt).toLocaleString()} • Status: {o.status} • Order ID: {o.id}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatGBP(o.totalPence)}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>Driver notes:</div>
                <div style={{ height: 44, border: "1px solid #000" }} />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ borderBottom: "1px solid #000", padding: "6px 0" }}>Item</th>
                    <th style={{ borderBottom: "1px solid #000", padding: "6px 0", width: 60 }}>Qty</th>
                    <th style={{ borderBottom: "1px solid #000", padding: "6px 0", width: 120 }}>Unit</th>
                    <th style={{ borderBottom: "1px solid #000", padding: "6px 0", width: 120 }}>Line</th>
                    <th style={{ borderBottom: "1px solid #000", padding: "6px 0", width: 100 }}>Picked</th>
                  </tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ padding: "8px 0" }}>
                        <div style={{ fontWeight: 700 }}>{it.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{it.productId}</div>
                      </td>
                      <td style={{ padding: "8px 0" }}>{it.quantity}</td>
                      <td style={{ padding: "8px 0" }}>{formatGBP(it.pricePence)}</td>
                      <td style={{ padding: "8px 0" }}>{formatGBP(it.pricePence * it.quantity)}</td>
                      <td style={{ padding: "8px 0" }}>
                        <div style={{ width: 18, height: 18, border: "1px solid #000" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {!loading && orders.length === 0 ? (
          <div style={{ padding: 16, border: "1px dashed #999", opacity: 0.8 }}>
            No order ids provided. Go back to admin and select orders to print.
          </div>
        ) : null}
      </div>
    </main>
  );
}
