import type { NextPage } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminFetch, loadAdminCreds, saveAdminCreds } from "@/lib/adminClientAuth";

type OrderItem = {
  id: string;
  productId: string | null;
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

function formatGBPFromPence(pence: number) {
  const gbp = (Number(pence || 0) / 100).toFixed(2);
  return `£${gbp}`;
}

function normStatus(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, "-");
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

const DispatchPage: NextPage = () => {
  const [user, setUser] = useState("mike");
  const [pass, setPass] = useState("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Auto-fill + auto-load if creds exist in this tab session
  useEffect(() => {
    const stored = loadAdminCreds();
    if (stored) {
      setUser(stored.username);
      setPass(stored.password);
      void load(stored.username, stored.password, { silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

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
        o.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [orders, q]);

  const paidIds = useMemo(
    () => filteredOrders.filter((o) => normStatus(o.status) === "PAID").map((o) => o.id),
    [filteredOrders]
  );

  const ofdIds = useMemo(
    () =>
      filteredOrders
        .filter((o) => normStatus(o.status) === "OUT-FOR-DELIVERY")
        .map((o) => o.id),
    [filteredOrders]
  );

  async function load(u = user, p = pass, opts?: { silent?: boolean }) {
    if (!p) {
      setErr("Enter the admin password, then click Load.");
      return;
    }

    // remember for this tab session
    saveAdminCreds({ username: u, password: p });

    setLoading(true);
    if (!opts?.silent) setErr(null);

    try {
      // Keep using your existing API filters (works with current DB casing)
      const paid = await adminFetch<{ ok: true; orders: Order[] }>(
        `/api/admin/orders?status=paid&take=200`,
        { username: u, password: p }
      );

      const ofd = await adminFetch<{ ok: true; orders: Order[] }>(
        `/api/admin/orders?status=out-for-delivery&take=200`,
        { username: u, password: p }
      );

      const merged = [...(paid.orders || []), ...(ofd.orders || [])].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1
      );

      setOrders(merged);
      setSelected({});
    } catch (e: any) {
      setOrders([]);
      setSelected({});
      setErr(e?.message ?? "Failed to load dispatch orders");
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

  function selectAll(ids: string[]) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
  }

  function unselectAll(ids: string[]) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  function printSelected() {
    if (!selectedIds.length) return;
    const ids = selectedIds.join(",");
    window.open(`/admin/print?ids=${encodeURIComponent(ids)}`, "_blank", "noopener,noreferrer");
  }

  async function bulkSetStatus(nextStatus: "out-for-delivery" | "delivered") {
    if (!pass) {
      setErr("Enter the admin password first.");
      return;
    }
    if (!selectedIds.length) return;

    saveAdminCreds({ username: user, password: pass });

    setLoading(true);
    setErr(null);

    try {
      for (const id of selectedIds) {
        await adminFetch<{ ok: true; order: any }>(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
          username: user,
          password: pass,
        });
      }

      await load(user, pass, { silent: true });
    } catch (e: any) {
      setErr(e?.message ?? "Bulk update failed");
    } finally {
      setLoading(false);
    }
  }

  async function printAndMarkOutForDelivery() {
    printSelected();
    await bulkSetStatus("out-for-delivery");
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      {/* Sticky control bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "white",
          borderBottom: "1px solid #eee",
          paddingBottom: 12,
          marginBottom: 12,
        }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 34 }}>Dispatch</h1>

          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin">← Admin Home</Link>
            <Link href="/admin/orders">Orders</Link>
          </div>
        </header>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Username</div>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="mike"
              style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 180 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Password</div>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="password"
              type="password"
              style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 220 }}
            />
          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              height: 42,
            }}
          >
            {loading ? "Loading…" : "Load"}
          </button>

          <div style={{ flex: 1 }} />

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="postcode, name, phone, email, id, order number…"
              style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 360, maxWidth: "70vw" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13 }}>
            <strong>Selected:</strong> {selectedIds.length} • <strong>Total:</strong> {formatGBPFromPence(selectedTotal)}
          </div>

          <button
            onClick={clearSelection}
            disabled={!selectedIds.length}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Clear
          </button>

          <button
            onClick={printSelected}
            disabled={!selectedIds.length}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: selectedIds.length ? "#111" : "#f5f5f5",
              color: selectedIds.length ? "#fff" : "#999",
              cursor: selectedIds.length ? "pointer" : "not-allowed",
            }}
          >
            Print selected
          </button>

          <button
            onClick={printAndMarkOutForDelivery}
            disabled={!selectedIds.length || loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #111",
              background: selectedIds.length ? "#111" : "#f5f5f5",
              color: selectedIds.length ? "#fff" : "#999",
              cursor: selectedIds.length ? "pointer" : "not-allowed",
            }}
          >
            Print + mark OUT-FOR-DELIVERY
          </button>

          <button
            onClick={() => bulkSetStatus("delivered")}
            disabled={!selectedIds.length || loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: selectedIds.length ? "pointer" : "not-allowed",
            }}
          >
            Mark DELIVERED
          </button>

          <div style={{ flex: 1 }} />

          {/* Quick-select buttons */}
          <button
            onClick={() => selectAll(paidIds)}
            disabled={!paidIds.length}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Select all PAID ({paidIds.length})
          </button>
          <button
            onClick={() => unselectAll(paidIds)}
            disabled={!paidIds.length}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Unselect PAID
          </button>

          <button
            onClick={() => selectAll(ofdIds)}
            disabled={!ofdIds.length}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Select all OUT-FOR-DELIVERY ({ofdIds.length})
          </button>
          <button
            onClick={() => unselectAll(ofdIds)}
            disabled={!ofdIds.length}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
          >
            Unselect OFD
          </button>
        </div>

        {err && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #f0c", borderRadius: 10, background: "#fff5fb" }}>
            <strong>Error:</strong> {err}
          </div>
        )}
      </div>

      {/* Orders table */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={{ width: 44, padding: 10, textAlign: "center" }} />
              <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Created</th>
              <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Status</th>
              <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Customer</th>
              <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Postcode</th>
              <th style={{ padding: 10, textAlign: "left", fontSize: 12, opacity: 0.8 }}>Items</th>
              <th style={{ padding: 10, textAlign: "right", fontSize: 12, opacity: 0.8 }}>Total</th>
              <th style={{ padding: 10, textAlign: "right", fontSize: 12, opacity: 0.8 }} />
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 10, textAlign: "center" }}>
                  <input type="checkbox" checked={!!selected[o.id]} onChange={() => toggle(o.id)} />
                </td>
                <td style={{ padding: 10 }}>{fmtDate(o.createdAt)}</td>
                <td style={{ padding: 10, fontWeight: 800 }}>{normStatus(o.status)}</td>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>{o.customerName || "-"}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{o.customerEmail || ""}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{o.customerPhone || ""}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{o.orderNumber || o.id}</div>
                </td>
                <td style={{ padding: 10, fontWeight: 800 }}>{o.postcode || "-"}</td>
                <td style={{ padding: 10, fontSize: 13 }}>
                  {(o.items || []).slice(0, 3).map((it) => (
                    <div key={it.id}>
                      • {it.quantity} × {it.name || it.productId || "Item"}
                    </div>
                  ))}
                  {(o.items || []).length > 3 && <div>…</div>}
                </td>
                <td style={{ padding: 10, textAlign: "right", fontWeight: 900 }}>{formatGBPFromPence(o.totalPence)}</td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  <Link href={`/admin/orders/${o.id}`}>View →</Link>
                </td>
              </tr>
            ))}

            {!filteredOrders.length && (
              <tr>
                <td colSpan={8} style={{ padding: 16, textAlign: "center", opacity: 0.7 }}>
                  No dispatch orders found (PAID / OUT-FOR-DELIVERY). Click Load.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
        Tip: with session auth enabled, you only type the password once per tab.
      </div>
    </main>
  );
};

export default DispatchPage;