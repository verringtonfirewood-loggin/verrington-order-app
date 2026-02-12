import type { GetServerSideProps, NextPage } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

type OrderItem = {
  id: string;
  orderId: string;
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
  customerEmail: string;
  postcode: string;
  totalPence: number;
  status: string;
  items: OrderItem[];
};

type Props = {
  order: Order;
  statuses: string[];
};

function getBaseUrl(req: any) {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers["host"] as string);
  return `${proto}://${host}`;
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

const AdminOrderDetailPage: NextPage<Props> = ({ order, statuses }) => {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const items = order.items ?? [];

  const computedTotal = useMemo(() => {
    const itemsTotal = items.reduce(
      (sum, it) => sum + (it.pricePence ?? 0) * (it.quantity ?? 0),
      0
    );
    return { itemsTotal };
  }, [items]);

  const statusOptions = useMemo(() => {
    // Ensure current status is always selectable even if list is empty
    const base = Array.isArray(statuses) && statuses.length ? statuses : [order.status];
    return Array.from(new Set([order.status, ...base]));
  }, [statuses, order.status]);

  const dirty = status !== order.status;

  async function setAndSave(nextStatus: string) {
    // update UI immediately then save
    setStatus(nextStatus);

    // if it's already the saved status, don't spam PATCH
    if (nextStatus === order.status) return;

    // Reuse the existing save logic but for the chosen status
    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const r = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const txt = await r.text();
      let payload: any = null;
      try {
        payload = txt ? JSON.parse(txt) : null;
      } catch {
        payload = txt;
      }

      if (!r.ok) {
        const msg =
          payload?.error ||
          payload?.message ||
          (typeof payload === "string" ? payload : null) ||
          `Request failed: ${r.status}`;
        setError(msg);
        return;
      }

      const newStatus = payload?.order?.status ?? nextStatus;
      order.status = newStatus;
      setStatus(newStatus);

      setOkMsg(`Saved: ${String(newStatus).toUpperCase()}`);
      setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Link href="/admin/orders" style={{ textDecoration: "none", opacity: 0.8 }}>
          ← Back to Orders
        </Link>
        <div style={{ marginLeft: "auto", opacity: 0.7 }}>
          Created: {formatDate(order.createdAt)}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>Order</h1>
          <div
            style={{
              marginTop: 6,
              opacity: 0.8,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {order.id}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "white",
                }}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {String(s).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

<div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <QuickBtn
    label="Confirm"
    disabled={saving}
    onClick={() => setAndSave("confirmed")}
  />
  <QuickBtn
    label="Paid"
    disabled={saving}
    onClick={() => setAndSave("paid")}
  />
  <QuickBtn
    label="Out for delivery"
    disabled={saving}
    onClick={() => setAndSave("out-for-delivery")}
  />
  <QuickBtn
    label="Delivered"
    disabled={saving}
    onClick={() => setAndSave("delivered")}
  />
  <QuickBtn
    label="Cancel"
    disabled={saving}
    danger
    onClick={() => setAndSave("cancelled")}
  />
</div>

            {okMsg && <span style={{ marginTop: 18, color: "green" }}>{okMsg}</span>}
            {error && <span style={{ marginTop: 18, color: "crimson" }}>{error}</span>}
          </div>

          <div style={{ marginTop: 12, opacity: 0.85 }}>
            Total: <b>{formatGBP(order.totalPence)}</b>
            <span style={{ opacity: 0.6 }}> (items sum: {formatGBP(computedTotal.itemsTotal)})</span>
          </div>
        </div>

        <div style={{ flex: "1 1 420px", border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Customer</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>{order.customerName || "—"}</div>
          <div style={{ marginTop: 4, opacity: 0.8 }}>{order.customerEmail || "—"}</div>
          <div style={{ marginTop: 4, opacity: 0.8 }}>{order.customerPhone || "—"}</div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>Postcode</div>
          <div style={{ marginTop: 6, opacity: 0.9 }}>{order.postcode || "—"}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, background: "#fafafa", fontWeight: 600 }}>Items</div>

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
    </div>
  );
};

const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontSize: 12, opacity: 0.7 };
const td: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top" };
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const tdRight: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const req = ctx.req as any;
  const id = String(ctx.params?.id || "");
  const baseUrl = getBaseUrl(req);
  const authorization = (req.headers["authorization"] as string) || "";

  const orderRes = await fetch(`${baseUrl}/api/admin/orders/${encodeURIComponent(id)}`, {
    headers: authorization ? { authorization } : undefined,
  });

  if (!orderRes.ok) return { notFound: true };

  const order = (await orderRes.json()) as Order;

  const statusesRes = await fetch(`${baseUrl}/api/admin/orders/statuses`, {
    headers: authorization ? { authorization } : undefined,
  });

  let statuses: string[] = [];
  if (statusesRes.ok) {
    const j = await statusesRes.json();
    if (Array.isArray(j?.statuses)) statuses = j.statuses;
  }

  return { props: { order, statuses } };
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
      }}
    >
      {label}
    </button>
  );
}


export default AdminOrderDetailPage;
