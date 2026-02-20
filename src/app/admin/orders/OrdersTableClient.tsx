// src/app/admin/orders/OrdersTableClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function money(pence: number) {
  return `\u00A3${(pence / 100).toFixed(2)}`;
}

function paymentLabel(method?: string) {
  if (!method) return "\u2014";
  const m = method.toUpperCase();
  if (m === "MOLLIE") return "CARD";
  return m;
}

function paymentIcon(method?: string) {
  const m = paymentLabel(method);
  if (m === "CARD") return "\u{1F4B3}"; // 💳
  if (m === "BACS") return "\u{1F3E6}"; // 🏦
  if (m === "CASH") return "\u{1F4B5}"; // 💵
  return "\u{1F4B7}"; // 💷
}

function paymentPillClasses(paymentStatus?: string) {
  const s = (paymentStatus || "").toUpperCase();

  if (s === "PAID") return "bg-green-50 text-green-700 border-green-200";
  if (s === "FAILED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "EXPIRED") return "bg-orange-50 text-orange-700 border-orange-200";
  if (s === "PENDING") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (s === "CANCELED") return "bg-gray-100 text-gray-600 border-gray-200";

  return "bg-gray-50 text-gray-600 border-gray-200";
}

function statusPillClasses(status?: string) {
  const s = String(status || "").toUpperCase();
  if (s === "NEW") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "PAID") return "bg-green-50 text-green-700 border-green-200";
  if (s === "OFD") return "bg-purple-50 text-purple-700 border-purple-200";
  if (s === "DELIVERED") return "bg-green-50 text-green-700 border-green-200";
  if (s === "CANCELLED") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

/**
 * Bulletproof row highlighting (NO Tailwind scanning required)
 * Returns inline bg + left stripe colours.
 */
function rowTone(o: any, isSelected: boolean) {
  const status = String(o.status || "").toUpperCase();
  const pay = String(o.paymentStatus || "").toUpperCase();

  // Selected (always visible)
  if (isSelected) return { bg: "#f5f3ff", left: "#c4b5fd" }; // purple-50 / purple-300

  // Cancelled
  if (status === "CANCELLED") return { bg: "#fef2f2", left: "#fecaca" }; // red-50 / red-200

  // Issues
  if (pay === "FAILED" || pay === "EXPIRED" || pay === "CANCELED")
    return { bg: "#fff7ed", left: "#fed7aa" }; // orange-50 / orange-200

  // Pending
  if (pay === "PENDING") return { bg: "#fefce8", left: "#fde68a" }; // yellow-50 / yellow-200

  // Good (paid or delivered)
  if (pay === "PAID" || status === "DELIVERED") return { bg: "#ecfdf5", left: "#bbf7d0" }; // green-50 / green-200

  // Default
  return { bg: "", left: "" };
}

function formatOrderRef(o: any) {
  const raw = o?.orderNumber;

  // Already formatted like "VF001"
  if (typeof raw === "string" && /^VF\d{3,}$/i.test(raw.trim())) {
    return raw.trim().toUpperCase();
  }

  // Number or numeric string → VF + pad
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== "" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : null;

  if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
    const padded = String(Math.trunc(n)).padStart(3, "0");
    return `VF${padded}`;
  }

  // Fallback: last digits in id, else id short
  const digits = String(o?.id || "").match(/\d+/)?.[0];
  if (digits) {
    const padded = digits.slice(-3).padStart(3, "0");
    return `VF${padded}`;
  }
  return String(o?.id || "").slice(0, 8);
}

export default function OrdersTableClient({ orders }: { orders: any[] }) {
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ANY");
  const [hideCancelled, setHideCancelled] = useState<boolean>(true);
  const [hideArchived, setHideArchived] = useState<boolean>(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (hideCancelled && String(o.status || "").toUpperCase() === "CANCELLED") return false;
      if (hideArchived && o.archivedAt) return false;

      if (paymentFilter !== "ALL" && String(o.paymentStatus || "") !== paymentFilter) return false;

      if (statusFilter !== "ANY") {
        if (String(o.status || "") !== statusFilter) return false;
      }

      return true;
    });
  }, [orders, paymentFilter, statusFilter, hideCancelled, hideArchived]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllShown() {
    setSelectedIds(filteredOrders.map((o) => o.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function bulk(action: "cancel" | "restore" | "archive" | "unarchive") {
    if (!selectedIds.length) return;

    let reason: string | undefined;
    if (action === "cancel") {
      reason = prompt("Cancel reason (optional):") || "";
    }

    await fetch("/api/admin/orders/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: selectedIds, reason }),
    });

    window.location.reload();
  }

  const idsParam = encodeURIComponent(selectedIds.join(","));

  return (
    <div className="mt-4">
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Payment:</span>
          {["ALL", "UNPAID", "PAID", "PENDING", "FAILED", "EXPIRED", "CANCELED"].map((p) => (
            <button
              key={p}
              onClick={() => setPaymentFilter(p)}
              className={`rounded-full border px-3 py-1 ${
                paymentFilter === p ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              {p === "ALL" ? "All" : p.toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold">Status:</span>
          {["ANY", "NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 ${
                statusFilter === s ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              {s === "ANY" ? "Any" : s.toLowerCase()}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hideCancelled}
            onChange={(e) => setHideCancelled(e.target.checked)}
          />
          Hide cancelled
        </label>

        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hideArchived}
            onChange={(e) => setHideArchived(e.target.checked)}
          />
          Hide archived
        </label>

        <div className="ml-auto text-gray-600">
          Showing <strong>{filteredOrders.length}</strong> / {orders.length}
        </div>
      </div>

      {/* Bulk / selection */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={selectAllShown} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
          Select all (shown)
        </button>
        <button onClick={clearSelection} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
          Clear selection
        </button>

        <Link
          href={`/admin/orders/selected?ids=${idsParam}`}
          className={`rounded-lg border px-3 py-2 ${
            selectedIds.length ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"
          }`}
        >
          View selected ({selectedIds.length})
        </Link>

        <Link
          href={`/admin/orders/selected?ids=${idsParam}&print=1`}
          className={`rounded-lg border px-3 py-2 ${
            selectedIds.length ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"
          }`}
        >
          Print selected ({selectedIds.length})
        </Link>

        <div className="ml-auto flex gap-2">
          <button
            disabled={!selectedIds.length}
            onClick={() => bulk("cancel")}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel selected
          </button>
          <button
            disabled={!selectedIds.length}
            onClick={() => bulk("restore")}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            Restore
          </button>
          <button
            disabled={!selectedIds.length}
            onClick={() => bulk("archive")}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            disabled={!selectedIds.length}
            onClick={() => bulk("unarchive")}
            className="rounded-lg border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            Unarchive
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full">
          <thead className="bg-gray-50 text-sm">
            <tr>
              <th className="w-10 p-3"></th>
              <th className="p-3">Order No.</th>
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
              const isSelected = selectedSet.has(o.id);
              const isArchived = !!o.archivedAt;
              const tone = rowTone(o, isSelected);

              const cellStyle = tone.bg
                ? ({ backgroundColor: tone.bg } as React.CSSProperties)
                : undefined;

              const orderRef = formatOrderRef(o);

              return (
                <tr
                  key={o.id}
                  className={["border-t transition-colors", isArchived ? "opacity-60" : ""].join(" ")}
                >
                  <td
                    className="p-3 align-top border-l-4"
                    style={{
                      ...(tone.bg ? { backgroundColor: tone.bg } : {}),
                      ...(tone.left ? { borderLeftColor: tone.left } : {}),
                    }}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(o.id)} />
                  </td>

                  <td className="p-3 align-top font-semibold text-purple-700" style={cellStyle}>
                    {orderRef}
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    {new Date(o.createdAt).toLocaleString("en-GB")}
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusPillClasses(
                          o.status
                        )}`}
                      >
                        {String(o.status || "").toUpperCase()}
                      </span>
                      {isArchived ? <div className="text-xs text-gray-500">Archived</div> : null}
                    </div>
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${paymentPillClasses(
                        o.paymentStatus
                      )}`}
                    >
                      <span>{paymentIcon(o.checkoutPaymentMethod)}</span>
                      <span>{paymentLabel(o.checkoutPaymentMethod)}</span>
                      <span>\u2022</span>
                      <span>{String(o.paymentStatus || "").toUpperCase()}</span>
                    </span>
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    <div className="font-semibold">{o.customerName}</div>
                    {o.customerEmail ? <div className="text-gray-500">{o.customerEmail}</div> : null}
                    {o.cancelReason ? (
                      <div className="mt-1 text-xs text-gray-700">
                        <span className="font-semibold">Reason:</span> {o.cancelReason}
                      </div>
                    ) : null}
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    <div className="font-semibold">{o.postcode}</div>
                  </td>

                  <td className="p-3 align-top" style={cellStyle}>
                    {(o.items || []).slice(0, 2).map((it: any) => (
                      <div key={it.id}>
                        \u2022 {it.quantity} \u00D7 {it.name}
                      </div>
                    ))}
                    {(o.items || []).length > 2 ? (
                      <div className="text-gray-500">+{o.items.length - 2} more</div>
                    ) : null}
                  </td>

                  <td className="p-3 align-top text-right" style={cellStyle}>
                    <span className="font-semibold">{money(o.totalPence)}</span>
                  </td>

                  <td className="p-3 align-top text-right" style={cellStyle}>
                    <Link href={`/admin/orders/${o.id}`} className="text-purple-700 underline">
                      View \u2192
                    </Link>
                  </td>
                </tr>
              );
            })}

            {!filteredOrders.length ? (
              <tr>
                <td colSpan={10} className="p-6 text-sm text-gray-600">
                  No orders match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
