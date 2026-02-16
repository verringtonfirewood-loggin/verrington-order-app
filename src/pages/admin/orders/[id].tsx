import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { adminFetch, loadAdminCreds, saveAdminCreds } from "@/lib/adminClientAuth";

type OrderItem = {
  id: string;
  productId: string | null;
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

  // NEW: payment trail
  paymentMethod: string; // checkoutPaymentMethod enum (MOLLIE/CASH/BACS)
  paymentStatus: string; // paymentStatus enum (PAID/FAILED/etc.)
  paidAt: string | null;
};

function formatGBP(pence?: number) {
  const value = typeof pence === "number" ? pence / 100 : 0;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
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

function paymentBadge(method: string, status: string) {
  return `${paymentLabel(method)} • ${String(status || "").toUpperCase() || "—"}`;
}

const AdminOrderDetailPage: NextPage = () => {
  const router = useRouter();
  const id = useMemo(() => (typeof router.query.id === "string" ? router.query.id : ""), [router.query.id]);

  const [username, setUsername] = useState("mike");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    const stored = loadAdminCreds();
    if (stored) {
      setUsername(stored.username);
      setPassword(stored.password);
    }
  }, []);

  useEffect(() => {
    // Auto-load when we have an id + stored creds
    const stored = loadAdminCreds();
    if (id && stored?.username && stored?.password) {
      void loadOrder(stored.username, stored.password, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadOrder(u = username, p = password, opts?: { silent?: boolean }) {
    if (!id) return;
    if (!u || !p) {
      setError("Enter username and password, then click Load.");
      return;
    }

    saveAdminCreds({ username: u, password: p });

    setLoading(true);
    if (!opts?.silent) setError(null);

    try {
      const [orderJson, statusJson] = await Promise.all([
        adminFetch<{ ok: true; order: Order }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: "GET",
          username: u,
          password: p,
        }),
        adminFetch<{ ok: true; statuses: string[] }>(`/api/admin/orders/statuses`, {
          method: "GET",
          username: u,
          password: p,
        }).catch(() => ({ ok: true as const, statuses: [] as string[] })),
      ]);

      const o: Order = orderJson.order;
      setOrder(o);
      setStatus(o.status);
      setStatuses(Array.isArray((statusJson as any)?.statuses) ? (statusJson as any).statuses : []);
    } catch (e: any) {
      setOrder(null);
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function setAndSave(nextStatus: string) {
    if (!id) return;
    if (!username || !password) {
      setError("Enter username and password first.");
      return;
    }

    saveAdminCreds({ username, password });

    setSaving(true);
    setOkMsg(null);
    setError(null);

    try {
      const json = await adminFetch<{ ok: true; order: Order }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
        username,
        password,
      });

      setOrder(json.order);
      setStatus(json.order.status);
      setOkMsg("Saved");
      setTimeout(() => setOkMsg(null), 1500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const items = order?.items ?? [];
  const itemsSubtotal = items.reduce((sum, it) => sum + (it.pricePence || 0) * (it.quantity || 0), 0);

  const statusOptions = useMemo(() => {
    const fromApi = (statuses || []).filter(Boolean);
    const fallback = ["new", "pending", "confirmed", "paid", "out-for-delivery", "delivered", "cancelled"];
    const list = fromApi.length ? fromApi : fallback;
    // Keep current status at top if not present
    if (order?.status && !list.includes(order.status)) return [order.status, ...list];
    return list;
  }, [statuses, order?.status]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/admin/orders">← Orders</Link>
          <Link href="/admin/dispatch">Dispatch</Link>
          <Link href="/admin">Admin Home</Link>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            style={{ ...inp, width: 160 }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            style={{ ...inp, width: 160 }}
          />
          <button disabled={loading || !id} onClick={() => loadOrder()} style={btnPrimary}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid #f0c", background: "#fff5fb" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!order && !loading && (
        <div style={{ marginTop: 14, opacity: 0.8 }}>
          Enter password and click <strong>Load</strong>.
        </div>
      )}

      {order && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
            <div style={{ flex: "1 1 420px" }}>
              <h1 style={{ margin: 0, fontSize: 24 }}>Order {order.orderNumber ? `• ${order.orderNumber}` : ""}</h1>
              <div
                style={{
                  marginTop: 6,
                  opacity: 0.8,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {order.id}
              </div>

              <div style={{ marginTop: 10, opacity: 0.7 }}>Created: {formatDate(order.createdAt)}</div>

              {/* NEW: payment at-a-glance */}
              <div style={{ marginTop: 8, opacity: 0.95, fontWeight: 900 }}>
                Payment: {paymentBadge(order.paymentMethod, order.paymentStatus)}
                {order.paidAt ? <span style={{ opacity: 0.75, fontWeight: 700 }}> • {formatDate(order.paidAt)}</span> : null}
              </div>

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

                <Link
                  href={`/admin/print?ids=${encodeURIComponent(order.id)}`}
                  style={{ ...btnSecondary, textDecoration: "none", display: "inline-block" }}
                >
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

              <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Totals</div>
                  <div style={{ fontWeight: 900 }}>{formatGBP(order.totalPence)}</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  Items subtotal (computed): <strong>{formatGBP(itemsSubtotal)}</strong>
                </div>
              </div>
            </div>

            <div style={{ flex: "1 1 420px", border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Customer</div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>{order.customerName || "—"}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{order.customerEmail || "—"}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{order.customerPhone || "—"}</div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Postcode</div>
              <div style={{ marginTop: 6, opacity: 0.95, fontWeight: 800 }}>{order.postcode || "—"}</div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Payment details</div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>
                {paymentLabel(order.paymentMethod)} • {String(order.paymentStatus || "").toUpperCase()}
              </div>
              <div style={{ marginTop: 4, opacity: 0.85, fontSize: 13 }}>
                {order.paidAt ? `Paid at: ${formatDate(order.paidAt)}` : "Paid at: —"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: 12, background: "#fafafa", fontWeight: 700 }}>Items</div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "white" }}>
                  <th style={th}>Item</th>
                  <th style={th}>Product ID</th>
                  <th style={thRight}>Qty</th>
                  <th style={thRight}>Unit</th>
                  <th style={thRight}>Line</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const line = (it.pricePence || 0) * (it.quantity || 0);
                  return (
                    <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={td}>{it.name || "—"}</td>
                      <td style={{ ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", opacity: 0.85 }}>
                        {it.productId || "—"}
                      </td>
                      <td style={tdRight}>{it.quantity ?? 0}</td>
                      <td style={tdRight}>{formatGBP(it.pricePence)}</td>
                      <td style={tdRight}>{formatGBP(line)}</td>
                    </tr>
                  );
                })}

                {!items.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, textAlign: "center", opacity: 0.7 }}>
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Current status: <strong>{normStatus(order.status)}</strong>
          </div>
        </>
      )}
    </main>
  );
};

function QuickBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
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
const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontSize: 12, opacity: 0.7 };
const td: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top" };
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default AdminOrderDetailPage;