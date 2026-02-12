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
  createdAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  postcode?: string;
  totalPence?: number;
  status: string; // lowercase
  items?: OrderItem[];
};

type ApiListResponse = {
  orders: Order[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
};

type Props = {
  orders: Order[];
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
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function normalisePostcode(pc?: string) {
  return (pc || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function itemsSummary(items?: OrderItem[]) {
  if (!items || !items.length) return "—";
  return items.map((i) => `${i.name} ×${i.quantity}`).join(", ");
}

function statusLabel(s: string) {
  return String(s || "unknown").toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const s = (status || "unknown").toLowerCase();
  const cls =
    s === "paid"
      ? "bg-green-100 text-green-800"
      : s === "out-for-delivery"
      ? "bg-blue-100 text-blue-800"
      : s === "delivered"
      ? "bg-slate-100 text-slate-800"
      : s === "confirmed"
      ? "bg-emerald-100 text-emerald-800"
      : s === "cancelled"
      ? "bg-red-100 text-red-800"
      : "bg-zinc-100 text-zinc-800";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {statusLabel(status)}
    </span>
  );
}

const AdminDispatchPage: NextPage<Props> = ({ orders }) => {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = orders || [];

    const f = needle
      ? base.filter((o) => {
          const pc = (o.postcode || "").toLowerCase();
          const name = (o.customerName || "").toLowerCase();
          const email = (o.customerEmail || "").toLowerCase();
          const phone = (o.customerPhone || "").toLowerCase();
          const id = (o.id || "").toLowerCase();
          return (
            pc.includes(needle) ||
            name.includes(needle) ||
            email.includes(needle) ||
            phone.includes(needle) ||
            id.includes(needle)
          );
        })
      : base;

    return [...f].sort((a, b) => {
      const ap = normalisePostcode(a.postcode);
      const bp = normalisePostcode(b.postcode);
      if (ap < bp) return -1;
      if (ap > bp) return 1;

      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (at !== bt) return at - bt;

      return a.id.localeCompare(b.id);
    });
  }, [orders, q]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const allVisibleSelected = useMemo(() => {
    if (!filtered.length) return false;
    return filtered.every((o) => !!selected[o.id]);
  }, [filtered, selected]);

  function toggleAllVisible() {
    const next: Record<string, boolean> = { ...selected };
    const target = !allVisibleSelected;
    filtered.forEach((o) => {
      next[o.id] = target;
    });
    setSelected(next);
  }

  function toggleOne(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function clearSelection() {
    setSelected({});
  }

  function printSelected() {
    setErr(null);
    const ids = selectedIds;
    if (!ids.length) {
      setErr("Select at least one order to print.");
      return;
    }
    const url = `/admin/print?ids=${encodeURIComponent(ids.join(","))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function printAndMarkOutForDelivery() {
    setMsg(null);
    setErr(null);

    const ids = selectedIds;
    if (!ids.length) {
      setErr("Select at least one order to print.");
      return;
    }

    setBusy(true);
    try {
      const nextStatus = "out-for-delivery";
      const concurrency = 5;
      let idx = 0;
      const failures: { id: string; message: string }[] = [];

      async function worker() {
        while (idx < ids.length) {
          const myIdx = idx++;
          const id = ids[myIdx];

          try {
            const r = await fetch(
              `/api/admin/orders/${encodeURIComponent(id)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
              }
            );

            const text = await r.text();
            let payload: any = null;
            try {
              payload = text ? JSON.parse(text) : null;
            } catch {
              payload = text;
            }

            if (!r.ok) {
              const m =
                payload?.error ||
                payload?.message ||
                (typeof payload === "string" ? payload : null) ||
                `HTTP ${r.status}`;
              failures.push({ id, message: m });
            }
          } catch (e: any) {
            failures.push({ id, message: e?.message ?? String(e) });
          }
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, ids.length) },
          () => worker()
        )
      );

      if (failures.length) {
        setErr(
          `Some updates failed: ${failures.length}/${ids.length}. First: ${failures[0].id} – ${failures[0].message}`
        );
      } else {
        setMsg(`Marked ${ids.length} order(s) → OUT FOR DELIVERY.`);
      }

      // Open print regardless (driver still needs sheets)
      const url = `/admin/print?ids=${encodeURIComponent(ids.join(","))}`;
      window.open(url, "_blank", "noopener,noreferrer");

      // Refresh the dispatch list after a short delay
      setTimeout(() => window.location.reload(), failures.length ? 1200 : 700);
    } finally {
      setBusy(false);
    }
  }

  async function bulkSetStatus(nextStatus: "out-for-delivery" | "delivered") {
    setMsg(null);
    setErr(null);

    const ids = selectedIds;
    if (!ids.length) {
      setErr("Select at least one order first.");
      return;
    }

    setBusy(true);
    try {
      const concurrency = 5;
      let idx = 0;
      const failures: { id: string; message: string }[] = [];

      async function worker() {
        while (idx < ids.length) {
          const myIdx = idx++;
          const id = ids[myIdx];

          try {
            const r = await fetch(
              `/api/admin/orders/${encodeURIComponent(id)}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
              }
            );

            const text = await r.text();
            let payload: any = null;
            try {
              payload = text ? JSON.parse(text) : null;
            } catch {
              payload = text;
            }

            if (!r.ok) {
              const m =
                payload?.error ||
                payload?.message ||
                (typeof payload === "string" ? payload : null) ||
                `HTTP ${r.status}`;
              failures.push({ id, message: m });
            }
          } catch (e: any) {
            failures.push({ id, message: e?.message ?? String(e) });
          }
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, ids.length) },
          () => worker()
        )
      );

      if (failures.length) {
        setErr(
          `Updated with errors: ${failures.length}/${ids.length} failed. First error: ${failures[0].id} – ${failures[0].message}`
        );
      } else {
        setMsg(`Updated ${ids.length} order(s) → ${statusLabel(nextStatus)}.`);
      }

      setTimeout(
        () => window.location.reload(),
        failures.length ? 1200 : 700
      );
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => {
    const selectedOrders = orders.filter((o) => selected[o.id]);
    const totalPence = selectedOrders.reduce(
      (sum, o) => sum + (o.totalPence ?? 0),
      0
    );
    return { count: selectedOrders.length, totalPence };
  }, [orders, selected]);

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Dispatch</h1>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/admin" style={{ textDecoration: "none", opacity: 0.8 }}>
            ← Admin Home
          </Link>
          <Link
            href="/admin/orders"
            style={{ textDecoration: "none", opacity: 0.8 }}
          >
            Orders →
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 360px" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            Search (postcode, name, email, phone, id)
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. TA1, Test Customer"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => bulkSetStatus("out-for-delivery")}
            disabled={busy || selectedIds.length === 0}
            style={{
              height: 40,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background:
                busy || selectedIds.length === 0 ? "#999" : "#111",
              color: "white",
              cursor:
                busy || selectedIds.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Mark selected → OUT FOR DELIVERY
          </button>

          <button
            onClick={() => bulkSetStatus("delivered")}
            disabled={busy || selectedIds.length === 0}
            style={{
              height: 40,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background:
                busy || selectedIds.length === 0 ? "#999" : "#111",
              color: "white",
              cursor:
                busy || selectedIds.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Mark selected → DELIVERED
          </button>

          <button
            onClick={clearSelection}
            disabled={busy || selectedIds.length === 0}
            style={{
              height: 40,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor:
                busy || selectedIds.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity: busy || selectedIds.length === 0 ? 0.6 : 1,
            }}
          >
            Clear selection
          </button>

          <button
            onClick={printSelected}
            disabled={busy || selectedIds.length === 0}
            style={{
              height: 40,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor:
                busy || selectedIds.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity: busy || selectedIds.length === 0 ? 0.6 : 1,
            }}
          >
            Print selected
          </button>

          <button
            onClick={printAndMarkOutForDelivery}
            disabled={busy || selectedIds.length === 0}
            style={{
              height: 40,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background:
                busy || selectedIds.length === 0 ? "#999" : "#111",
              color: "white",
              cursor:
                busy || selectedIds.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Print + mark OUT FOR DELIVERY
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          opacity: 0.9,
        }}
      >
        <div>
          Showing <b>{filtered.length}</b> order(s) (Paid + Out for delivery)
        </div>
        <div>
          Selected <b>{totals.count}</b> · Total{" "}
          <b>{formatGBP(totals.totalPence)}</b>
        </div>
        {msg && <div style={{ color: "green" }}>{msg}</div>}
        {err && <div style={{ color: "crimson" }}>{err}</div>}
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid #eee",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                />
              </th>
              <th style={th}>Postcode</th>
              <th style={th}>Customer</th>
              <th style={th}>Status</th>
              <th style={th}>Items</th>
              <th style={thRight}>Total</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td style={{ padding: 16 }} colSpan={7}>
                  No matching orders.
                </td>
              </tr>
            ) : (
              filtered.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={!!selected[o.id]}
                      onChange={() => toggleOne(o.id)}
                      aria-label={`Select order ${o.id}`}
                    />
                  </td>

                  <td style={tdMono}>
                    <div style={{ fontWeight: 700 }}>
                      {normalisePostcode(o.postcode) || "—"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {o.id.slice(0, 8)}
                    </div>
                  </td>

                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {o.customerName || "—"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {o.customerPhone || o.customerEmail || "—"}
                    </div>
                  </td>

                  <td style={td}>
                    <StatusPill status={o.status} />
                  </td>

                  <td style={td}>
                    <div style={{ fontSize: 13 }}>{itemsSummary(o.items)}</div>
                  </td>

                  <td style={tdRight}>{formatGBP(o.totalPence)}</td>

                  <td style={td}>
                    <Link
                      href={`/admin/orders/${encodeURIComponent(o.id)}`}
                      style={{ textDecoration: "none" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, opacity: 0.75 }}>
        Tip: use <b>Print + mark OUT FOR DELIVERY</b> when the orders are
        physically loaded and ready to go.
      </div>
    </div>
  );
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  fontSize: 12,
  opacity: 0.7,
};
const thRight: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "12px 12px", verticalAlign: "top" };
const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
const tdMono: React.CSSProperties = {
  ...td,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const req = ctx.req as any;
  const baseUrl = getBaseUrl(req);
  const authorization = (req.headers["authorization"] as string) || "";

  async function fetchStatus(status: string): Promise<Order[]> {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("page", "1");
    params.set("pageSize", "200");

    const r = await fetch(`${baseUrl}/api/admin/orders?${params.toString()}`, {
      headers: authorization ? { authorization } : undefined,
    });

    if (!r.ok) return [];
    const j = (await r.json()) as ApiListResponse;
    return Array.isArray(j.orders) ? j.orders : [];
  }

  const [paid, ofd] = await Promise.all([
    fetchStatus("paid"),
    fetchStatus("out-for-delivery"),
  ]);

  const map = new Map<string, Order>();
  for (const o of [...paid, ...ofd]) map.set(o.id, o);

  return {
    props: {
      orders: Array.from(map.values()),
    },
  };
};

export default AdminDispatchPage;
