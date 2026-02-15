import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

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
  customerEmail: string | null;
  postcode: string;
  totalPence: number;
  status: string;
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

function formatGBP(pence?: number) {
  const value = typeof pence === "number" ? pence / 100 : 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const AdminOrderDetailPage: NextPage = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  const [user, setUser] = useState("mike");
  const [pass, setPass] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");

  const authHeader = useMemo(() => {
    const pair = `${user}:${pass}`;
    const b64 = base64Utf8(pair);
    return `Basic ${b64}`;
  }, [user, pass]);

  async function load() {
    if (!id) return;
    if (!pass) {
      setError("Enter the admin password, then click Load.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [orderRes, statusesRes] = await Promise.all([
        fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { headers: { Authorization: authHeader } }),
        fetch(`/api/admin/orders/statuses`, { headers: { Authorization: authHeader } }),
      ]);

      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson?.ok) throw new Error(orderJson?.error ?? "Failed to load order");

      const statusJson = statusesRes.ok ? await statusesRes.json() : null;
      const statusList = Array.isArray(statusJson?.statuses) ? statusJson.statuses : [];

      const o: Order = orderJson.order;
      setOrder(o);
      setStatus(o.status);
      setStatuses(statusList);
    } catch (e: any) {
      setOrder(null);
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const items = order?.items ?? [];
  const itemsTotal = items.reduce((sum, it) => sum + (it.pricePence ?? 0) * (it.quantity ?? 0), 0);

  const statusOptions = useMemo(() => {
    const current = order?.status ? [order.status] : [];
    const list = Array.isArray(statuses) && statuses.length ? statuses : [];
    return Array.from(new Set([...current, ...list]));
  }, [statuses, order?.status]);

  async function setAndSave(nextStatus: string) {
    if (!order) return;
    if (!pass) {
      setError("Enter the admin password first.");
      return;
    }

    setStatus(nextStatus);
    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const r = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ status: nextStatus }),
      });

      const txt = await r.text();
      let payload: any = null;
      try {
        payload = txt ? JSON.parse(txt) : null;
      } catch {
        payload = txt;
      }

      if (!r.ok || !payload?.ok) {
        const msg = payload?.error || payload?.message || (typeof payload === "string" ? payload : null) || `Request failed: ${r.status}`;
        setError(msg);
        return;
      }

      const updated: Order = payload.order;
      setOrder(updated);
      setStatus(updated.status);

      setOkMsg(`Saved: ${String(updated.status).toUpperCase()}`);
      setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Link href="/admin/orders" style={{ textDecoration: "none", opacity: 0.8 }}>
          ← Back to Orders
        </Link>
        <Link href="/admin" style={{ textDecoration: "none", opacity: 0.8 }}>
          Admin Home
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={load} disabled={loading} style={btnPrimary}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </div>

      <section style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Basic Auth</div>
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Username</div>
            <input value={user} onChange={(e) => setUser(e.target.value)} style={inp} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Password</div>
            <input value={pass} onChange={(e) => setPass(e.target.value)} style={inp} type="password" />
          </label>
        </div>
      </section>

      {error ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #f3c2c2", borderRadius: 12, background: "#fff5f5" }}>
          <div style={{ fontWeight: 800, color: "crimson" }}>Fix needed</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      ) : null}

      {!order ? (
        <div style={{ marginTop: 14, opacity: 0.75 }}>Load an order to begin.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginTop: 14 }}>
            <div style={{ flex: "1 1 420px" }}>
              <h1 style={{ margin: 0, fontSize: 24 }}>Order {order.orderNumber ? `• ${order.orderNumber}` : ""}</h1>
              <div style={{ marginTop: 6, opacity: 0.8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                {order.id}
              </div>
              <div style={{ marginTop: 10, opacity: 0.7 }}>Created: {formatDate(order.createdAt)}</div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Status</div>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {String(s).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <button disabled={saving || status === order.status} onClick={() => setAndSave(status)} style={btnPrimary}>
                  {saving ? "Saving…" : "Save"}
                </button>

                <Link href={`/admin/print?ids=${encodeURIComponent(order.id)}`} style={{ ...btnSecondary, textDecoration: "none", display: "inline-block" }}>
                  Print docket
                </Link>

                {okMsg ? <span style={{ color: "green", fontWeight: 800 }}>{okMsg}</span> : null}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <QuickBtn label="Confirm" disabled={saving} onClick={() => setAndSave("confirmed")} />
                <QuickBtn label="Paid" disabled={saving} onClick={() => setAndSave("paid")} />
                <QuickBtn label="Out for delivery" disabled={saving} onClick={() => setAndSave("out-for-delivery")} />
                <QuickBtn label="Delivered" disabled={saving} onClick={() => setAndSave("delivered")} />
                <QuickBtn label="Cancel" disabled={saving} danger onClick={() => setAndSave("cancelled")} />
              </div>

              <div style={{ marginTop: 12, opacity: 0.85 }}>
                Total: <b>{formatGBP(order.totalPence)}</b>
                <span style={{ opacity: 0.6 }}> (items sum: {formatGBP(itemsTotal)})</span>
              </div>
            </div>

            <div style={{ flex: "1 1 420px", border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Customer</div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>{order.customerName || "—"}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{order.customerEmail || "—"}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{order.customerPhone || "—"}</div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Postcode</div>
              <div style={{ marginTop: 6, opacity: 0.95, fontWeight: 800 }}>{order.postcode || "—"}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Items</div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={th}>Item</th>
                  <th style={thRight}>Qty</th>
                  <th style={thRight}>Unit</th>
                  <th style={thRight}>Line</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const line = (it.pricePence ?? 0) * (it.quantity ?? 0);
                  return (
                    <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={td}>{it.name}</td>
                      <td style={tdRight}>{it.quantity}</td>
                      <td style={tdRight}>{formatGBP(it.pricePence)}</td>
                      <td style={tdRight}>{formatGBP(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
};

function QuickBtn({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: danger ? "#fff5f5" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {label}
    </button>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" };
const btnPrimary: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "white", fontWeight: 900, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", fontWeight: 900, cursor: "pointer" };

const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontSize: 12, opacity: 0.7 };
const td: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top" };
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default AdminOrderDetailPage;
