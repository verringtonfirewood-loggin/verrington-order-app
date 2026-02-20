"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function money(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function paymentLabel(method?: string) {
  if (!method) return "—";
  const m = method.toUpperCase();
  if (m === "MOLLIE") return "CARD";
  return m;
}

function paymentIcon(method?: string) {
  const m = paymentLabel(method);
  if (m === "CARD") return "💳";
  if (m === "BACS") return "🏦";
  if (m === "CASH") return "💵";
  return "💷";
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

function rowTone(o: any, isSelected: boolean) {
  const status = String(o.status || "").toUpperCase();
  const pay = String(o.paymentStatus || "").toUpperCase();

  if (isSelected) return { bg: "#f5f3ff", left: "#c4b5fd" };
  if (status === "CANCELLED") return { bg: "#fef2f2", left: "#fecaca" };
  if (pay === "FAILED" || pay === "EXPIRED" || pay === "CANCELED")
    return { bg: "#fff7ed", left: "#fed7aa" };
  if (pay === "PENDING") return { bg: "#fefce8", left: "#fde68a" };
  if (pay === "PAID" || status === "DELIVERED")
    return { bg: "#ecfdf5", left: "#bbf7d0" };

  return { bg: "", left: "" };
}

function formatOrderRef(o: any) {
  const raw = o?.orderNumber;

  if (typeof raw === "string" && /^VF\d{3,}$/i.test(raw.trim())) {
    return raw.trim().toUpperCase();
  }

  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : null;

  if (typeof n === "number" && Number.isFinite(n)) {
    return `VF${String(Math.trunc(n)).padStart(3, "0")}`;
  }

  const id = String(o?.id || "");
  const digits = id.match(/\d+/)?.[0];
  if (digits) {
    return `VF${digits.slice(-3).padStart(3, "0")}`;
  }

  return id.slice(0, 8);
}

export default function OrdersTableClient({ orders }: { orders: any[] }) {
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ANY");
  const [hideCancelled, setHideCancelled] = useState(true);
  const [hideArchived, setHideArchived] = useState(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (hideCancelled && o.status === "CANCELLED") return false;
      if (hideArchived && o.archivedAt) return false;
      if (paymentFilter !== "ALL" && o.paymentStatus !== paymentFilter) return false;
      if (statusFilter !== "ANY" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, paymentFilter, statusFilter, hideCancelled, hideArchived]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllShown() {
    setSelectedIds(filteredOrders.map((o) => o.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const idsParam = encodeURIComponent(selectedIds.join(","));

  return (
    <div className="mt-4">
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
              const tone = rowTone(o, isSelected);
              const cellStyle = tone.bg
                ? ({ backgroundColor: tone.bg } as React.CSSProperties)
                : undefined;

              const orderRef = formatOrderRef(o);

              return (
                <tr key={o.id} className="border-t">
                  <td
                    className="p-3 border-l-4"
                    style={{
                      ...(tone.bg ? { backgroundColor: tone.bg } : {}),
                      ...(tone.left ? { borderLeftColor: tone.left } : {}),
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(o.id)}
                    />
                  </td>

                  {/* ✅ CLICKABLE ORDER NUMBER */}
                  <td className="p-3" style={cellStyle}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-semibold text-purple-700 hover:underline"
                    >
                      {orderRef}
                    </Link>
                  </td>

                  <td className="p-3" style={cellStyle}>
                    {new Date(o.createdAt).toLocaleString()}
                  </td>

                  <td className="p-3" style={cellStyle}>
                    {o.status}
                  </td>

                  <td className="p-3" style={cellStyle}>
                    {String(o.paymentStatus || "").toUpperCase()}
                  </td>

                  <td className="p-3" style={cellStyle}>
                    <div className="font-semibold">{o.customerName}</div>
                  </td>

                  <td className="p-3" style={cellStyle}>
                    {o.postcode}
                  </td>

                  <td className="p-3" style={cellStyle}>
                    {(o.items || []).slice(0, 2).map((it: any) => (
                      <div key={it.id}>
                        • {it.quantity} × {it.name}
                      </div>
                    ))}
                  </td>

                  <td className="p-3 text-right" style={cellStyle}>
                    {money(o.totalPence)}
                  </td>

                  <td className="p-3 text-right" style={cellStyle}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-purple-700 underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}

            {!filteredOrders.length && (
              <tr>
                <td colSpan={10} className="p-6 text-sm text-gray-600">
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
