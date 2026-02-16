// src/app/admin/orders/OrdersTableClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function formatPence(pence: number) {
  return `£${(Number(pence) / 100).toFixed(2)}`;
}

export default function OrdersTableClient({ orders }: { orders: any[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedCount = selectedIds.length;
  const idsParam = useMemo(() => selectedIds.join(","), [selectedIds]);

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAll() {
    setSelectedIds(orders.map((o) => o.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button onClick={selectAll} className="rounded-lg border px-3 py-1">
          Select all
        </button>

        <button onClick={clearSelection} className="rounded-lg border px-3 py-1">
          Clear selection
        </button>

        {/* ✅ Single (non-duplicate) View selected button */}
        <Link
          href={`/admin/orders/selected?ids=${encodeURIComponent(idsParam)}`}
          className={`rounded-lg px-3 py-1 ${
            selectedCount
              ? "bg-purple-700 text-white"
              : "pointer-events-none bg-slate-200 text-slate-500"
          }`}
        >
          View selected ({selectedCount})
        </Link>

        {/* Print selected (this prints the current page UI, not a custom print view) */}
        <button
          className={`rounded-lg px-3 py-1 ${
            selectedCount
              ? "bg-black text-white"
              : "pointer-events-none bg-slate-200 text-slate-500"
          }`}
          onClick={() => window.print()}
        >
          Print selected ({selectedCount})
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm">
            <tr>
              <th className="w-10 p-3"></th>
              <th className="p-3">Created</th>
              <th className="p-3">Status</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Postcode</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>

          <tbody>
            {orders.map((o) => {
              const total = formatPence(o.totalPence); // ✅ correct field per schema

              return (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o.id)}
                      onChange={() => toggleOne(o.id)}
                    />
                  </td>

                  <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>

                  <td className="p-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                      {o.status}
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold">{o.customerName}</div>
                    {o.customerEmail && (
                      <div className="text-sm opacity-70">{o.customerEmail}</div>
                    )}
                  </td>

                  <td className="p-3 font-semibold">{o.postcode}</td>

                  <td className="p-3 text-sm">
                    {o.items?.slice(0, 2).map((it: any) => (
                      <div key={it.id}>
                        • {it.quantity} × {it.name}
                      </div>
                    ))}
                    {o.items?.length > 2 && (
                      <div className="opacity-70">+{o.items.length - 2} more</div>
                    )}
                  </td>

                  <td className="p-3 text-right font-semibold">{total}</td>

                  <td className="p-3">
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
