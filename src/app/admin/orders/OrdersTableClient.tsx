// src/app/admin/orders/OrdersTableClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function paymentPill(paymentStatus: string, method: string) {
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold";
  const ps = (paymentStatus || "").toUpperCase();
  const m = (method || "").toUpperCase();

  if (ps === "PAID") return `${base} bg-green-100 text-green-800`;
  if (ps === "PENDING") return `${base} bg-yellow-100 text-yellow-800`;
  if (ps === "FAILED" || ps === "EXPIRED" || ps === "CANCELED") return `${base} bg-red-100 text-red-800`;
  return `${base} bg-gray-100 text-gray-800`;
}

function statusPill(status: string) {
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold";
  const s = (status || "").toUpperCase();
  if (s === "CANCELLED") return `${base} bg-red-100 text-red-800`;
  if (s === "DELIVERED") return `${base} bg-green-100 text-green-800`;
  if (s === "OFD") return `${base} bg-blue-100 text-blue-800`;
  if (s === "PAID") return `${base} bg-purple-100 text-purple-800`;
  return `${base} bg-gray-100 text-gray-800`;
}

export default function OrdersTableClient({ orders }: { orders: any[] }) {
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [hideCancelled, setHideCancelled] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const psOk = paymentFilter === "ALL" ? true : (o.paymentStatus || "") === paymentFilter;
      const stOk = statusFilter === "ALL" ? true : (o.status || "") === statusFilter;
      const cancelledOk = hideCancelled ? (o.status || "").toUpperCase() !== "CANCELLED" : true;
      return psOk && stOk && cancelledOk;
    });
  }, [orders, paymentFilter, statusFilter, hideCancelled]);

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.includes(o.id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredOrders.some((o) => o.id === id)));
    } else {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        filteredOrders.forEach((o) => set.add(o.id));
        return Array.from(set);
      });
    }
  }

  const idsParam = selectedIds.join(",");

  return (
    <div className="mt-6">
      <div className="sticky top-0 z-10 rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Payment</label>
            <select
              className="rounded-lg border p-2 text-sm"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="UNPAID">UNPAID</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="FAILED">FAILED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELED">CANCELED</option>
            </select>

            <label className="ml-2 text-sm font-medium text-gray-700">Status</label>
            <select
              className="rounded-lg border p-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="NEW">NEW</option>
              <option value="PAID">PAID</option>
              <option value="OFD">OFD</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <label className="ml-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hideCancelled}
                onChange={(e) => setHideCancelled(e.target.checked)}
              />
              Hide cancelled
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleAllFiltered}
              className="rounded-lg border px-3 py-2 text-sm font-medium"
            >
              {allFilteredSelected ? "Unselect filtered" : "Select filtered"}
            </button>

            <Link
              href={`/admin/orders/selected?ids=${encodeURIComponent(idsParam)}`}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
                selectedIds.length ? "bg-purple-700" : "bg-gray-400 pointer-events-none"
              }`}
            >
              Selected ({selectedIds.length})
            </Link>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Showing <strong>{filteredOrders.length}</strong> / {orders.length}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                />
              </th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Postcode</th>
              <th className="p-3">Status</th>
              <th className="p-3">Payment</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map((o) => {
              const cancelled = (o.status || "").toUpperCase() === "CANCELLED";
              return (
                <tr
                  key={o.id}
                  className={`${cancelled ? "bg-red-50" : ""} border-t`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleOne(o.id)}
                    />
                  </td>
                  <td className="p-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-purple-700 underline">
                      {o.orderNumber || o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-3">{o.customerName}</td>
                  <td className="p-3">{o.postcode}</td>
                  <td className="p-3">
                    <span className={statusPill(o.status)}>{o.status}</span>
                  </td>
                  <td className="p-3">
                    <span className={paymentPill(o.paymentStatus, o.checkoutPaymentMethod)}>
                      {o.checkoutPaymentMethod} • {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold">
                    £{((o.totalPence || 0) / 100).toFixed(2)}
                  </td>
                </tr>
              );
            })}

            {!filteredOrders.length && (
              <tr>
                <td className="p-6 text-center text-gray-600" colSpan={7}>
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
