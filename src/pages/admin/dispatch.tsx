import type { NextPage } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  postcode: string;
  status: string;
  totalPence: number;
  items: OrderItem[];
  orderNumber?: string | null;
};

function base64Utf8(input: string) {
  if (typeof window === "undefined") return "";
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary);
}

function formatGBPFromPence(pence: number) {
  const gbp = (pence || 0) / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(gbp);
}

const DispatchPage: NextPage = () => {
  const [user, setUser] = useState("mike");
  const [pass, setPass] = useState("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const authHeader = useMemo(() => {
    const pair = `${user}:${pass}`;
    const b64 = base64Utf8(pair);
    return `Basic ${b64}`;
  }, [user, pass]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const selectedTotal = useMemo(() => {
    const byId = new Map(orders.map((o) => [o.id, o]));
    return selectedIds.reduce((sum, id) => sum + (byId.get(id)?.totalPence ?? 0), 0);
  }, [orders, selectedIds]);

  const filteredOrders = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => {
      const hay = [
        o.postcode,
        o.customerName,
        o.customerPhone,
        o.customerEmail,
        o.id,
        o.orderNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [orders, q]);

  async function load() {
    if (!pass) {
      setErr("Enter the admin password, then click Load.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      // Paid + Out-for-delivery are the two “dispatch board” columns in practice
      const url = `/api/admin/orders?status=paid&take=200`;
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      const text = await res.text();
      const j = text ? JSON.parse(text) : null;
      if (!res.ok || !j?.ok) throw new Error(j?.error ?? "Failed to load paid orders");

      const paid = Array.isArray(j.orders) ? (j.orders as Order[]) : [];

      const url2 = `/api/admin/orders?status=out-for-delivery&take=200`;
      const res2 = await fetch(url2, { headers: { Authorization: authHeader } });
      const text2 = await res2.text();
      const j2 = text2 ? JSON.parse(text2) : null;
      if (!res2.ok || !j2?.ok) throw new Error(j2?.error ?? "Failed to load out-for-delivery orders");

      const ofd = Array.isArray(j2.orders) ? (j2.orders as Order[]) : [];

      const merged = [...paid, ...ofd].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setOrders(merged);
      setSelected({});
    } catch (e: any) {
      setOrders([]);
      setSelected({});
      setErr(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string, on?: boolean) {
    setSelected((prev) => ({ ...prev, [id]: typeof on === "boolean" ? on : !prev[id] }));
  }

  function clearSelection() {
    setSelected({});
  }

  async function bulkSetStatus(nextStatus: "out-for-delivery" | "delivered") {
    if (!pass) {
      setErr("Enter the admin password first.");
      return;
    }
    if (!selectedIds.length) return;

    setLoading(true);
    setErr(null);

    try {
      for (const id of selectedIds) {
        const r = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ status: nextStatus }),
        });
        const j = await r.json();
        if (!r.ok || !j?.ok) throw new Error(j?.error ?? `Failed updating ${id}`);
      }

      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Bulk update failed");
    } finally {
      setLoading(false);
    }
  }

  function printSelected() {
    if (!selectedIds.length) return;
    const ids = selectedIds.join(",");
    window.open(`/admin/print?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  async function printAndMarkOutForDelivery() {
    printSelected();
    await bulkSetStatus("out-for-delivery");
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 34 }}>Dispatch</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/admin" style={{ textDecoration: "none", opacity: 0.85 }}>
            ← Admin Home
          </Link>
          <Link href="/admin/orders" style={{ textDecoration: "none", opacity: 0.85 }}>
            Orders →
          </Link>
        </div>
      </header>

      <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
        <div style={{ fontSize: 14, opacity: 0.75 }}>Search (postcode, name, email, phone, id)</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. TA1, Test Customer" style={inpWide} />
      </div>

      <section style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Basic Auth</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Username</div>
            <input value={user} onChange={(e) => setUser(e.target.value)} style={inp} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Password</div>
            <input value={pass} onChange={(e) => setPass(e.target.value)} style={inp} type="password" />
          </label>

          <button onClick={load} disabled={loading} style={btnPrimary}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </section>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button disabled={!selectedIds.length || loading} onClick={() => bulkSetStatus("out-for-delivery")} style={btnBig}>
          Mark selected → OUT FOR DELIVERY
        </button>
        <button disabled={!selectedIds.length || loading} onClick={() => bulkSetStatus("delivered")} style={btnBig}>
          Mark selected → DELIVERED
        </button>
        <button disabled={!selectedIds.length || loading} onClick={clearSelection} style={btnGhost}>
          Clear selection
        </button>

        <button disabled={!selectedIds.length} onClick={printSelected} style={btnGhost}>
          Print selected
        </button>
        <button disabled={!selectedIds.length || loading} onClick={printAndMarkOutForDelivery} style={btnBig}>
          Print + mark OUT FOR DELIVERY
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 22 }}>
        Showing <b>{filteredOrders.length}</b> order(s) (Paid + Out for delivery){" "}
        <span style={{ opacity: 0.7 }}>
          Selected <b>{selectedIds.length}</b> • Total <b>{formatGBPFromPence(selectedTotal)}</b>
        </span>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f3c2c2", borderRadius: 12, background: "#fff5f5" }}>
          <div style={{ fontWeight: 900, color: "crimson" }}>Fix needed</div>
          <div style={{ marginTop: 6 }}>{err}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 18, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}><input type="checkbox" checked={selectedIds.length && selectedIds.length === filteredOrders.length ? true : false} onChange={(e) => {
                const on = e.target.checked;
                const next: Record<string, boolean> = {};
                for (const o of filteredOrders) next[o.id] = on;
                setSelected(next);
              }} /></th>
              <th style={th}>Postcode</th>
              <th style={th}>Customer</th>
              <th style={th}>Status</th>
              <th style={th}>Items</th>
              <th style={thRight}>Total</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={td}>
                  <input type="checkbox" checked={!!selected[o.id]} onChange={() => toggle(o.id)} />
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{o.postcode}</div>
                  <div style={{ opacity: 0.65, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {o.orderNumber ?? o.id.slice(0, 8)}
                  </div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{o.customerName}</div>
                  <div style={{ opacity: 0.8 }}>{o.customerPhone ?? "—"}</div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{String(o.status).toUpperCase()}</div>
                </td>
                <td style={td}>
                  {Array.isArray(o.items) && o.items.length ? (
                    <div style={{ fontSize: 14 }}>
                      {o.items.slice(0, 3).map((it) => (
                        <div key={it.id}>
                          {(it.name ?? it.productId)} ×{it.quantity}
                        </div>
                      ))}
                      {o.items.length > 3 ? <div style={{ opacity: 0.7 }}>+{o.items.length - 3} more…</div> : null}
                    </div>
                  ) : (
                    <span style={{ opacity: 0.7 }}>—</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>{formatGBPFromPence(o.totalPence)}</td>
                <td style={td}>
                  <Link href={`/admin/orders/${encodeURIComponent(o.id)}`} style={{ textDecoration: "none", fontWeight: 900 }}>
                    View →
                  </Link>
                </td>
              </tr>
            ))}

            {!loading && filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, opacity: 0.7 }}>
                  No matching orders.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, opacity: 0.7 }}>
        Tip: use <b>Print + mark OUT FOR DELIVERY</b> when the orders are physically loaded and ready to go.
      </p>
    </main>
  );
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" };
const inpWide: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #ddd", marginTop: 8, fontSize: 18 };

const btnPrimary: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", fontWeight: 900, cursor: "pointer" };
const btnBig: React.CSSProperties = { padding: "14px 16px", borderRadius: 10, border: "1px solid #111", background: "#777", color: "white", fontWeight: 900, cursor: "pointer" };
const btnGhost: React.CSSProperties = { padding: "14px 16px", borderRadius: 10, border: "1px solid #ddd", background: "white", color: "#111", fontWeight: 900, cursor: "pointer" };

const th: React.CSSProperties = { textAlign: "left", padding: 14, fontWeight: 800 };
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: 14, verticalAlign: "top" };

export default DispatchPage;
