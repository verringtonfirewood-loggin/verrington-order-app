// src/app/admin/orders/OrdersTableClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function formatPence(pence: number) {
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

function norm(s: unknown) {
  return String(s ?? "").trim().toUpperCase();
}

function paymentLabel(method: string) {
  const m = norm(method);
  if (m === "MOLLIE") return "CARD";
  return m || "—";
}

function paymentIcon(method: string) {
  const m = paymentLabel(method);
  if (m === "CARD") return "💳";
  if (m === "BACS") return "🏦";
  if (m === "CASH") return "💵";
  return "💷";
}

function paymentColours(method: string, status: string) {
  const m = norm(method);
  const s = norm(status);

  if (s === "PAID") return { bg: "#e8f7ee", fg: "#1f7a4c", border: "#b7ebce" };
  if (s === "PENDING") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };
  if (s === "FAILED") return { bg: "#fdecec", fg: "#b42318", border: "#f5c2c0" };
  if (s === "EXPIRED") return { bg: "#fff0e5", fg: "#9a3412", border: "#fed7aa" };
  if (s === "CANCELED" || s === "CANCELLED")
    return { bg: "#f4f4f5", fg: "#3f3f46", border: "#e4e4e7" };

  if (s === "UNPAID") {
    if (m === "BACS") return { bg: "#e8f3ff", fg: "#1e40af", border: "#bfdbfe" };
    if (m === "CASH") return { bg: "#f3f4f6", fg: "#111827", border: "#d1d5db" };
    if (m === "MOLLIE") return { bg: "#fff4e5", fg: "#b54708", border: "#fcd9bd" };
  }

  return { bg: "#f3f4f6", fg: "#444", border: "#e5e7eb" };
}

function PaymentPill({ method, status }: { method: string; status: string }) {
  const c = paymentColours(method, status);
  const label = paymentLabel(method);
  const icon = paymentIcon(method);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
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
      title={`${label} • ${norm(status) || "—"}`}
    >
      <span aria-hidden>{icon}</span>
      {label} • {norm(status) || "—"}
    </span>
  );
}

function rowTint(paymentStatus?: string) {
  const s = norm(paymentStatus);
  if (s === "PAID") return "bg-emerald-50";
  if (s === "PENDING") return "bg-amber-50";
  if (s === "FAILED") return "bg-red-50";
  if (s === "EXPIRED") return "bg-orange-50";
  if (s === "CANCELED" || s === "CANCELLED") return "bg-zinc-50";
  return "";
}

function rowBorder(paymentStatus?: string) {
  const s = norm(paymentStatus);
  if (s === "PAID") return "border-l-4 border-emerald-500";
  if (s === "PENDING") return "border-l-4 border-amber-500";
  if (s === "FAILED") return "border-l-4 border-red-500";
  if (s === "EXPIRED") return "border-l-4 border-orange-500";
  if (s === "CANCELED" || s === "CANCELLED") return "border-l-4 border-zinc-500";
  return "border-l-4 border-slate-200";
}

type PaymentFilter = "ALL" | "UNPAID" | "PAID" | "PENDING" | "ISSUES";
type StatusFilter = "ANY" | "NEW" | "CONFIRMED" | "PAID" | "OUT-FOR-DELIVERY" | "DELIVERED";

function pillBtn(active: boolean) {
  return `rounded-full border px-3 py-1 text-sm ${
    active ? "bg-black text-white border-black" : "bg-white hover:bg-slate-50"
  }`;
}

export default function OrdersTableClient({ orders }: { orders: any[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ANY");

  const selectedCount = selectedIds.length;
  const idsParam = useMemo(() => selectedIds.join(","), [selectedIds]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const pay = norm(o?.paymentStatus);
      const st = norm(o?.status);

      const paymentOk =
        paymentFilter === "ALL"
          ? true
          : paymentFilter === "UNPAID"
          ? pay === "UNPAID"
          : paymentFilter === "PAID"
          ? pay === "PAID"
          : paymentFilter === "PENDING"
          ? pay === "PENDING"
          : paymentFilter === "ISSUES"
          ? pay === "FAILED" || pay === "EXPIRED" || pay === "CANCELED" || pay === "CANCELLED"
          : true;

      const statusOk =
        statusFilter === "ANY" ? true : st === statusFilter;

      return paymentOk && statusOk;
    });
  }, [orders, paymentFilter, statusFilter]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAll() {
    // select all currently visible rows (filtered)
    setSelectedIds(filteredOrders.map((o) => o.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <div>
      {/* Top controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold opacity-70">Payment:</span>
          <button
            className={pillBtn(paymentFilter === "ALL")}
            onClick={() => setPaymentFilter("ALL")}
            type="button"
          >
            All
          </button>
          <button
            className={pillBtn(paymentFilter === "UNPAID")}
            onClick={() => setPaymentFilter("UNPAID")}
            type="button"
          >
            Unpaid
          </button>
          <button
            className={pillBtn(paymentFilter === "PAID")}
            onClick={() => setPaymentFilter("PAID")}
            type="button"
          >
            Paid
          </button>
          <button
            className={pillBtn(paymentFilter === "PENDING")}
            onClick={() => setPaymentFilter("PENDING")}
            type="button"
          >
            Pending
          </button>
          <button
            className={pillBtn(paymentFilter === "ISSUES")}
            onClick={() => setPaymentFilter("ISSUES")}
            type="button"
          >
            Issues
          </button>

          <span className="ml-2 text-sm font-semibold opacity-70">Status:</span>
          <button className={pillBtn(statusFilter === "ANY")} onClick={() => setStatusFilter("ANY")} type="button">
            Any
          </button>
          <button className={pillBtn(statusFilter === "NEW")} onClick={() => setStatusFilter("NEW")} type="button">
            New
          </button>
          <button
            className={pillBtn(statusFilter === "OUT-FOR-DELIVERY")}
            onClick={() => setStatusFilter("OUT-FOR-DELIVERY")}
            type="button"
          >
            Out for delivery
          </button>
          <button
            className={pillBtn(statusFilter === "DELIVERED")}
            onClick={() => setStatusFilter("DELIVERED")}
            type="button"
          >
            Delivered
          </button>

          <span className="ml-2 text-sm opacity-60">
            Showing <strong>{filteredOrders.length}</strong> / {orders.length}
          </span>
        </div>

        {/* Selection actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={selectAll} className="rounded-lg border px-3 py-1" type="button">
            Select all (shown)
          </button>
          <button onClick={clearSelection} className="rounded-lg border px-3 py-1" type="button">
            Clear selection
          </button>

          <Link
            href={`/admin/orders/selected?ids=${encodeURIComponent(idsParam)}`}
            className={`rounded-lg px-3 py-1 ${
              selectedCount ? "bg-purple-700 text-white" : "pointer-events-none bg-slate-200 text-slate-500"
            }`}
          >
            View selected ({selectedCount})
          </Link>

          <button
            className={`rounded-lg px-3 py-1 ${
              selectedCount ? "bg-black text-white" : "pointer-events-none bg-slate-200 text-slate-500"
            }`}
            onClick={() => window.print()}
            type="button"
          >
            Print selected ({selectedCount})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left">
          {/* ✅ Sticky header */}
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr className="text-sm">
              <th className="w-10 p-3"></th>
              <th className="p-3">Created</th>
              <th className="p-3">Status</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Postcode</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((o) => {
              const total = formatPence(o.totalPence);
              const tint = rowTint(o.paymentStatus);
              const border = rowBorder(o.paymentStatus);

              const method = String(o.checkoutPaymentMethod ?? o.paymentMethod ?? "");
              const payStatus = String(o.paymentStatus ?? "");

              return (
                <tr key={o.id} className={`border-t ${tint} ${border}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleOne(o.id)}
                    />
                  </td>

                  <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>

                  <td className="p-3">
                    <span className="rounded-full bg-white/70 px-3 py-1 text-sm">
                      {o.status}
                    </span>
                  </td>

                  <td className="p-3">
                    <PaymentPill method={method} status={payStatus} />
                  </td>

                  <td className="p-3">
                    <div className="font-semibold">{o.customerName}</div>
                    {o.customerEmail && <div className="text-sm opacity-70">{o.customerEmail}</div>}
                  </td>

                  <td className="p-3 font-semibold">{o.postcode}</td>

                  <td className="p-3 text-sm">
                    {o.items?.slice(0, 2).map((it: any) => (
                      <div key={it.id}>• {it.quantity} × {it.name}</div>
                    ))}
                    {o.items?.length > 2 && <div className="opacity-70">+{o.items.length - 2} more</div>}
                  </td>

                  <td className="p-3 text-right font-semibold">{total}</td>

                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-purple-700 underline">
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {!filteredOrders.length && (
              <tr>
                <td className="p-6 text-sm opacity-70" colSpan={9}>
                  No orders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
