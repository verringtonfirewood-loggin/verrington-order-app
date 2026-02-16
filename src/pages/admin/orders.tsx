import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminFetch, clearAdminCreds, loadAdminCreds, saveAdminCreds } from "@/lib/adminClientAuth";

type OrderItem = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  pricePence: number;
};

type OrderRow = {
  id: string;
  createdAt: string;
  status: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;
  postcode: string;

  totalPence: number;
  subtotalPence?: number;
  deliveryFeePence?: number;

  orderNumber: string | null;

  paymentMethod: string;
  paymentStatus: string;
  paidAt: string | null;

  items: OrderItem[];
};

type OrdersResp = { ok: true; orders: OrderRow[] } | { ok: false; error: string };

function gbp(pence: number) {
  return `£${(Number(pence || 0) / 100).toFixed(2)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(method: string) {
  const m = String(method || "").toUpperCase();
  if (m === "MOLLIE") return "CARD";
  return m || "—";
}

function paymentColours(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID") return { bg: "#e8f7ee", fg: "#1f7a4c", border: "#b7ebce", row: "#f3fbf7" };
  if (s === "FAILED") return { bg: "#fdecec", fg: "#b42318", border: "#f5c2c0", row: "#fff7f7" };
  if (s === "PENDING") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd", row: "#fffaf2" };
  if (s === "UNPAID") return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb", row: "" };
  return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb", row: "" };
}

function PaymentPill({ method, status }: { method: string; status: string }) {
  const c = paymentColours(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {paymentLabel(method)} • {String(status || "").toUpperCase() || "—"}
    </span>
  );
}

export default function OrdersPage() {
  const [username, setUsername] = useState("mike");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);

  const [status, setStatus] = useState<string>(""); // empty = all
  const [q, setQ] = useState("");
  const [take, setTake] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected]
  );

  const allVisibleSelected = useMemo(() => {
    if (!orders.length) return false;
    return orders.every((o) => selected[o.id]);
  }, [orders, selected]);

  useEffect(() => {
    const stored = loadAdminCreds();
    if (stored) {
      setUsername(stored.username);
      setPassword(stored.password);
      void loadOrders(stored.username, stored.password, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOrders(u = username, p = password, opts?: { silent?: boolean }) {
    if (!u || !p) {
      setError("Enter username and password, then click Load orders.");
      return;
    }

    if (rememberSession) saveAdminCreds({ username: u, password: p });

    const params = new URLSearchParams();
    params.set("take", String(take));
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);

    setLoading(true);
    if (!opts?.silent) setError(null);

    try {
      const data = await adminFetch<OrdersResp>(`/api/admin/orders?${params.toString()}`, {
        method: "GET",
        username: u,
        password: p,
      });

      if (!("ok" in data) || data.ok !== true) throw new Error((data as any)?.error || "Failed");

      setOrders(data.orders || []);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const o of data.orders || []) next[o.id] = Boolean(prev[o.id]);
        return next;
      });
    } catch (e: any) {
      setOrders([]);
      setSelected({});
      setError(e?.message ? String(e.message) : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = { ...prev };
      const newVal = !allVisibleSelected;
      for (const o of orders) next[o.id] = newVal;
      return next;
    });
  }

  function clearSelection() {
    setSelected({});
  }

  function logoutSession() {
    clearAdminCreds();
    setPassword("");
  }

  const printHref =
    selectedIds.length > 0 ? `/admin/print?ids=${encodeURIComponent(selectedIds.join(","))}` : "";

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Admin · Orders</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/admin">← Admin Home</Link>
          <button
            onClick={() => loadOrders()}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading…" : "Load orders"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Basic Auth</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={rememberSession}
                  onChange={(e) => setRememberSession(e.target.checked)}
                />
                Remember for this tab session
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={logoutSession}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              Clear saved
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Filters</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 140px", gap: 12, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="postcode, name, phone, email, order id, order number"
              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Status</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="">ALL</option>
              <option value="NEW">NEW</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PAID">PAID</option>
              <option value="OUT-FOR-DELIVERY">OUT-FOR-DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Limit</div>
            <select
              value={take}
              onChange={(e) => setTake(parseInt(e.target.value, 10))}
              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
          <button
            onClick={() => loadOrders()}
            disabled={loading}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
          >
            Apply
          </button>
          <button
            onClick={() => {
              setQ("");
              setStatus("");
              setTake(50);
              clearSelection();
            }}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Clear
          </button>

          <div style={{ flex: 1 }} />

          <Link href="/admin/dispatch">Go to Dispatch →</Link>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {error && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid #f0c", background: "#fff5fb" }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 700 }}>Orders ({orders.length})</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={toggleAllVisible}
              disabled={!orders.length}
              style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
            >
              {allVisibleSelected ? "Unselect all" : "Select all"}
            </button>
            <button
              onClick={clearSelection}
              disabled={!selectedIds.length}
              style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
            >
              Clear selection
            </button>

            {selectedIds.length ? (
              <Link
                href={printHref}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Print selected ({selectedIds.length})
              </Link>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.7 }}>Select orders to enable printing</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={{ width: 44, padding: 10, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected && orders.length > 0}
                    onChange={toggleAllVisible}
                    aria-label="Select all"
                  />
                </th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Created</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Status</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Payment</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Customer</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Postcode</th>
                <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Items</th>
                <th style={{ padding: 10, textAlign: "right", fontSize: 12, opacity: 0.8 }}>Total</th>
                <th style={{ padding: 10, textAlign: "right", fontSize: 12, opacity: 0.8 }} />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const c = paymentColours(o.paymentStatus);
                return (
                  <tr
                    key={o.id}
                    style={{
                      borderTop: "1px solid #eee",
                      background: c.row || undefined,
                    }}
                  >
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[o.id])}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select order ${o.id}`}
                      />
                    </td>

                    <td style={{ padding: 10 }}>{fmtDate(o.createdAt)}</td>
                    <td style={{ padding: 10, fontWeight: 700 }}>{String(o.status || "").toUpperCase()}</td>

                    <td style={{ padding: 10 }}>
                      <PaymentPill method={o.paymentMethod} status={o.paymentStatus} />
                      {o.paidAt ? (
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>{fmtDate(o.paidAt)}</div>
                      ) : null}
                    </td>

                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 700 }}>{o.customerName || "-"}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{o.customerEmail || ""}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{o.customerPhone || ""}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{o.orderNumber || o.id}</div>
                    </td>

                    <td style={{ padding: 10, fontWeight: 700 }}>{o.postcode || "-"}</td>

                    <td style={{ padding: 10, fontSize: 13 }}>
                      {(o.items || []).slice(0, 2).map((it) => (
                        <div key={it.id}>
                          • {it.quantity} × {it.name}
                        </div>
                      ))}
                      {(o.items || []).length > 2 && <div>…</div>}
                    </td>

                    <td style={{ padding: 10, textAlign: "right", fontWeight: 800 }}>{gbp(o.totalPence)}</td>
                    <td style={{ padding: 10, textAlign: "right" }}>
                      <Link href={`/admin/orders/${o.id}`}>View →</Link>
                    </td>
                  </tr>
                );
              })}

              {!orders.length && (
                <tr>
                  <td colSpan={9} style={{ padding: 16, textAlign: "center", opacity: 0.7 }}>
                    No orders loaded yet — enter credentials and click “Load orders”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
        Payment row tinting: green=PAID, red=FAILED, amber=PENDING.
      </div>
    </div>
  );
}
