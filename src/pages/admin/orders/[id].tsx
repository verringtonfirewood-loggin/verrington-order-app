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

  paymentMethod: string;
  paymentStatus: string;
  paidAt: string | null;
};

function formatGBP(pence?: number) {
  const value = typeof pence === "number" ? pence / 100 : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
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

function paymentColour(status: string) {
  const s = String(status || "").toUpperCase();

  if (s === "PAID") return { bg: "#e8f7ee", fg: "#1f7a4c", border: "#b7ebce" };
  if (s === "FAILED") return { bg: "#fdecec", fg: "#b42318", border: "#f5c2c0" };
  if (s === "PENDING") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };

  return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb" };
}

function PaymentPill({ method, status }: { method: string; status: string }) {
  const colours = paymentColour(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: colours.bg,
        color: colours.fg,
        border: `1px solid ${colours.border}`,
        letterSpacing: 0.3,
      }}
    >
      {paymentLabel(method)} • {String(status || "").toUpperCase()}
    </span>
  );
}

const AdminOrderDetailPage: NextPage = () => {
  const router = useRouter();
  const id = useMemo(
    () => (typeof router.query.id === "string" ? router.query.id : ""),
    [router.query.id]
  );

  const [username, setUsername] = useState("mike");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const stored = loadAdminCreds();
    if (stored) {
      setUsername(stored.username);
      setPassword(stored.password);
    }
  }, []);

  useEffect(() => {
    const stored = loadAdminCreds();
    if (id && stored?.username && stored?.password) {
      void loadOrder(stored.username, stored.password, true);
    }
  }, [id]);

  async function loadOrder(u = username, p = password, silent = false) {
    if (!id) return;
    if (!u || !p) {
      setError("Enter username and password.");
      return;
    }

    saveAdminCreds({ username: u, password: p });

    setLoading(true);
    if (!silent) setError(null);

    try {
      const json = await adminFetch<{ ok: true; order: Order }>(
        `/api/admin/orders/${encodeURIComponent(id)}`,
        { username: u, password: p }
      );

      setOrder(json.order);
      setStatus(json.order.status);
    } catch (e: any) {
      setOrder(null);
      setError(e?.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  async function saveStatus() {
    if (!id || !status) return;
    if (!username || !password) {
      setError("Enter username and password.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const json = await adminFetch<{ ok: true; order: Order }>(
        `/api/admin/orders/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          username,
          password,
        }
      );

      setOrder(json.order);
      setStatus(json.order.status);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!order)
    return (
      <main style={{ padding: 24 }}>
        <Link href="/admin/orders">← Orders</Link>
        <div style={{ marginTop: 20 }}>
          <button onClick={() => loadOrder()} disabled={loading}>
            {loading ? "Loading…" : "Load order"}
          </button>
          {error && <div style={{ color: "red" }}>{error}</div>}
        </div>
      </main>
    );

  const itemsSubtotal = order.items.reduce(
    (sum, it) => sum + it.pricePence * it.quantity,
    0
  );

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <Link href="/admin/orders">← Orders</Link>
          <h1 style={{ margin: "8px 0" }}>
            {order.orderNumber || order.id}
          </h1>

          {/* NEW pill */}
          <PaymentPill
            method={order.paymentMethod}
            status={order.paymentStatus}
          />

          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Created: {formatDate(order.createdAt)}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            {formatGBP(order.totalPence)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Status</h3>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {[
            "new",
            "pending",
            "confirmed",
            "paid",
            "out-for-delivery",
            "delivered",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {normStatus(s)}
            </option>
          ))}
        </select>

        <button onClick={saveStatus} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Items</h3>
        {order.items.map((it) => (
          <div key={it.id}>
            {it.quantity} × {it.name} — {formatGBP(it.pricePence)}
          </div>
        ))}

        <div style={{ marginTop: 10 }}>
          Subtotal (computed): {formatGBP(itemsSubtotal)}
        </div>
      </div>
    </main>
  );
};

export default AdminOrderDetailPage;